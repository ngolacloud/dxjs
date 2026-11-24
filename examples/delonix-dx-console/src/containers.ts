// Containers — the delonix-console compute/containers list reproduced on dxjs.
// Exercises every parity addition at once:
//   · @dxjs/query   — the container list (cache + dedupe), invalidated after actions
//   · @dxjs/ui      — appShell context, dataTable (sort/paginate), pill
//   · @dxjs/forms   — the "Deploy container" form (validated)
//   · virtualList   — the container logs panel (thousands of lines, few DOM nodes)
//   · onError       — a boundary around the page
// Client-side filters (tabs + text) match the console's stance: the two filters are
// over the loaded list, and say so.
import { signal, effect } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { component } from "@dxjs/component";
import { dataTable, card, pill, virtualList, type Column } from "@dxjs/ui";
import { query } from "@dxjs/query";
import { createForm } from "@dxjs/forms";
import { useApp } from "./ctx.ts";
import { meter, usageTone, typeGlyph } from "./widgets.ts";
import {
  availableActions,
  CONTAINER_FILTERS,
  CONTAINER_TONE,
  cpuPercent,
  formatBytes,
  matchesFilter,
  memoryUsage,
  normaliseStatus,
  shortId,
  type Container,
  type ContainerAction,
  type ContainerFilter,
} from "./compute.ts";

const ACTION_GLYPH: Record<ContainerAction, string> = {
  start: "▶",
  stop: "■",
  restart: "⟳",
  pause: "⏸",
  unpause: "▶",
  rm: "🗑",
};

export const ContainersPage = component(() => {
  const { api, qc } = useApp();
  // One ["containers"] query shared across the page; actions invalidate it.
  const q = query(qc, ["containers"], () => api.listContainers({ limit: 1000, offset: 0 }), { staleTime: 5_000 });
  const all = (): Container[] => q.data()?.items ?? [];

  const filter = signal<ContainerFilter>("all");
  const text = signal("");
  const busy = signal<string>(""); // "<id>:<action>" while in flight
  const selected = signal<string | null>(null);
  const logLines = signal<string[]>([]);
  const showDeploy = signal(false);

  const filtered = (): Container[] => {
    const t = text().trim().toLowerCase();
    return all().filter((c) => matchesFilter(c, filter()) && (!t || c.name.toLowerCase().includes(t) || c.image.toLowerCase().includes(t)));
  };
  const count = (f: ContainerFilter): number => all().filter((c) => matchesFilter(c, f)).length;

  // Default-select a container for the logs panel; (re)load logs on selection.
  effect(() => {
    const items = all();
    if (!selected() && items.length) selected.set(items[0]!.id);
  });
  effect(() => {
    const id = selected();
    if (!id) return;
    void api.logs(id).then((l) => logLines.set(l));
  });

  const run = (c: Container, action: ContainerAction): void => {
    busy.set(`${c.id}:${action}`);
    void api
      .action(c.id, action)
      .then(() => Promise.all([qc.invalidate(["containers"]), qc.invalidate(["kpis"])]))
      .finally(() => busy.set(""));
  };

  const deployForm = createForm<{ name: string; image: string; tag: string }>({
    initial: { name: "", image: "", tag: "" },
    validate: (v) => {
      const e: Partial<Record<"name" | "image" | "tag", string>> = {};
      if (!v.name.trim()) e.name = "name is required";
      if (!v.image.trim()) e.image = "image is required";
      return e;
    },
  });
  const submitDeploy = deployForm.handleSubmit((v) => {
    void api.deploy(v).then(() => Promise.all([qc.invalidate(["containers"]), qc.invalidate(["kpis"])]));
    deployForm.reset();
    showDeploy.set(false);
  });

  const columns: Column<Container>[] = [
    {
      key: "name",
      label: "Name",
      sortable: true,
      render: (r) => html`<span class="cell-name">
        <span class="type-glyph" aria-hidden="true">${typeGlyph(r.image)}</span>
        <button class="linkish" @click=${() => selected.set(r.id)} title="View logs">${r.name}</button>
        <span class="muted mono">${shortId(r.id)}</span>
      </span>`,
    },
    { key: "image", label: "Image", render: (r) => html`<span class="tag">${r.image}:${r.tag}</span>` },
    {
      key: "status",
      label: "Status",
      sortable: true,
      value: (r) => r.status,
      render: (r) => pill(r.status, CONTAINER_TONE[normaliseStatus(r.status)]),
    },
    {
      key: "cpu",
      label: "CPU",
      sortable: true,
      value: (r) => cpuPercent(r) ?? -1,
      render: (r) => {
        const p = cpuPercent(r);
        return meter(p, p === null ? "—" : `${p.toFixed(1)} %`, p === null ? "mut" : usageTone(p));
      },
    },
    {
      key: "memory",
      label: "Memory",
      render: (r) => {
        const u = memoryUsage(r);
        return meter(u.percent, `${formatBytes(u.used)} / ${u.limit > 0 ? formatBytes(u.limit) : "∞"}`, u.percent === null ? "mut" : usageTone(u.percent));
      },
    },
    {
      key: "actions",
      label: "",
      render: (r) => {
        const acts = availableActions(normaliseStatus(r.status));
        if (!acts.length) return html`<span class="muted">—</span>`;
        return html`<span class="acts">${acts.map(
          (a) => html`<button
            class=${"act" + (a === "rm" ? " act--danger" : "")}
            ?disabled=${() => busy() !== ""}
            title=${a}
            @click=${() => run(r, a)}
          >${() => (busy() === `${r.id}:${a}` ? "…" : ACTION_GLYPH[a])}</button>`,
        )}</span>`;
      },
    },
  ];

  const tab = (f: ContainerFilter): TemplateResult =>
    html`<button class=${() => "seg" + (filter() === f ? " is-active" : "")} @click=${() => filter.set(f)}>
      ${f[0]!.toUpperCase() + f.slice(1)} <span class="seg-count">${() => count(f)}</span>
    </button>`;

  const deployPanel = (): TemplateResult => {
    const fld = (name: "name" | "image" | "tag", ph: string): TemplateResult => html`<label class="fld">
      <input class="dx-input" placeholder=${ph}
        @input=${deployForm.field(name).onInput} @blur=${deployForm.field(name).onBlur} />
      <span class="fld-err">${() => (deployForm.touched(name)() && deployForm.error(name)()) || ""}</span>
    </label>`;
    return card({
      title: "Deploy container",
      body: html`<form class="deploy" @submit=${submitDeploy}>
        ${fld("name", "name (e.g. web-1)")}${fld("image", "image (e.g. nginx)")}${fld("tag", "tag (default: latest)")}
        <div class="demo-row">
          <button class="dx-btn is-primary" type="submit" ?disabled=${() => !deployForm.isValid()}>Deploy</button>
          <button class="dx-btn" type="button" @click=${() => showDeploy.set(false)}>Cancel</button>
        </div>
      </form>`,
    });
  };

  return html`
    <h1 class="dx-h1">Containers</h1>
    <p class="dx-sub muted">GET /v2/containers · filters below are over the loaded list (the server returns no per-status counts)</p>

    <div class="toolbar">
      <div class="segmented">${CONTAINER_FILTERS.map(tab)}</div>
      <input class="dx-input search" placeholder="Filter this list…" @input=${(e: Event) => text.set((e.target as HTMLInputElement).value)} />
      <div class="spacer"></div>
      <span class="muted">${() => (q.isFetching() ? "refreshing…" : "")}</span>
      <button class="dx-btn is-primary" @click=${() => showDeploy.update((x) => !x)}>Deploy container</button>
    </div>

    ${() => (showDeploy() ? deployPanel() : "")}

    ${dataTable<Container>({
      columns,
      rows: () => filtered(),
      // Version the key with the mutable fields: a keyed list reuses a row with an
      // unchanged key WITHOUT re-rendering it, so after an action the status/cpu/mem
      // cells would go stale. Including them makes the row re-render on change.
      rowKey: (r) => `${r.id}:${r.status}:${r.cpu}:${r.mem}`,
      pageSize: 10,
      search: false,
    })}

    ${card({
      title: "Logs",
      body: html`<div class="logs">
        <div class="logs-head muted">${() => {
          const id = selected();
          const c = all().find((x) => x.id === id);
          return c ? `${c.name} · ${logLines().length} lines (virtualized)` : "Pick a container (click its name) to stream logs";
        }}</div>
        ${virtualList<string>({
          rows: () => logLines(),
          rowHeight: 22,
          height: 280,
          key: (_, i) => i,
          render: (line) => html`<span class="logline">${line}</span>`,
        })}
      </div>`,
    })}
  `;
});
