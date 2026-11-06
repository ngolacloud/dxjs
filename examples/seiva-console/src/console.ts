// SeivaConsole — the Delonix Seiva "Console Admin" reproduced with dxjs, dressed
// in the @dxjs/ui design system (dashboard shell + stat tiles + data table).
//
// Parity with seiva/crates/seiva-console-admin/src/lib.rs (ADMIN_JS):
//   - a bearer-token input whose `change` reloads the console (so entering a
//     token reveals the resources the caller is authorized to see);
//   - it fetches /admin/registry.json (with the token) and /openapi.json, then
//     for each registered resource renders EITHER a data table (when it has a
//     `list` op and can.view) OR operation forms;
//   - EVERY value is written through dxjs safe sinks (textContent / setAttribute),
//     never innerHTML of data, so an attacker-controlled field cannot inject an
//     element — the strict admin CSP needs no unsafe-inline. @dxjs/ui only toggles
//     CSS classes (the look lives in a same-origin stylesheet), so it keeps that
//     guarantee: no inline <style>, no eval.
//
// The `can.*` flags only hide affordances the caller lacks. They are NOT a
// security boundary: the Seiva backend enforces every operation server-side via
// the module's #[seiva::controller]. We mirror that stance exactly.

import { signal, computed } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { component, onMount } from "@dxjs/component";
import type { Client } from "@dxjs/transport";
import { appShell, card, dataTable, statGrid, type Column } from "@dxjs/ui";
import { classifyOps, bodyFields, opsForResource, type Classified, type OpenApiSpec } from "./contract.ts";
import { loadRegistry, loadSpec, callOp, type AdminResource } from "./api.ts";

type TokenAccessor = () => string;
type Row = Record<string, unknown>;

/** A stable id for a resource (its nav key / active selector). */
const resKey = (r: AdminResource): string => `${r.namespace}/${r.resource}`;

/** Read every `[data-k]` control in a form into a plain-object request body. */
function collectForm(form: Element): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  form.querySelectorAll("[data-k]").forEach((node) => {
    const el = node as HTMLInputElement;
    const key = el.dataset.k;
    if (!key) return;
    if (el.value === "") return;
    body[key] = el.value;
  });
  return body;
}

/** The create form for a resource (shown only when the caller may create). */
function createForm(client: Client, token: TokenAccessor, create: NonNullable<Classified["create"]>): TemplateResult {
  const out = signal("");
  const fields = bodyFields(create.op);
  const onSubmit = (ev: Event): void => {
    ev.preventDefault();
    const body = collectForm(ev.target as Element);
    out.set("…");
    callOp(client, "POST", create.path, body, token())
      .then(() => out.set("created"))
      .catch((e: unknown) => out.set("create failed: " + String(e)));
  };
  return html`<form class="op create" @submit=${onSubmit}>
    <div class="sig"><span class="m">POST</span><span class="path">${create.path}</span></div>
    <div class="fields">
      ${fields.map((n) => html`<label>${n} <input class="dx-input" data-k=${n} /></label>`)}
    </div>
    <button type="submit" class="dx-btn is-primary">Create</button>
    <div class="out">${() => out()}</div>
  </form>`;
}

/** A resource with a `list` op renders the admin table: optional create + the
 *  @dxjs/ui dataTable (search / sort / paginate), with every cell written as TEXT. */
function dataResource(
  client: Client,
  token: TokenAccessor,
  r: AdminResource,
  k: Classified,
): TemplateResult {
  const rows = signal<Row[]>([]);
  const msg = signal("loading…");
  const fields = r.list_fields && r.list_fields.length ? r.list_fields : ["id"];
  const list = k.list as NonNullable<Classified["list"]>;

  // Fire the list call. Mirrors ADMIN_JS refresh(); the server-side search/order/
  // page controls are replaced by the dataTable's own client-side ones (an
  // example-level choice). Fire-and-forget: results land via the `rows` signal.
  const refresh = (): void => {
    callOp(client, "GET", list.path, undefined, token())
      .then((data) => {
        const arr = Array.isArray(data) ? (data as Row[]) : [];
        rows.set(arr);
        msg.set(arr.length ? "" : "no records yet");
      })
      .catch((e: unknown) => msg.set("could not list: " + String(e)));
  };
  refresh();

  // Each column reads its field as a plain string — the dataTable renders that
  // through a text sink, so attacker-controlled data can never inject an element.
  const columns: Column<Row>[] = fields.map((f) => ({
    key: f,
    label: f,
    sortable: true,
    value: (row) => (row[f] === undefined || row[f] === null ? "" : String(row[f])),
  }));

  const table = dataTable<Row>({
    title: r.label,
    columns,
    rows: () => rows(),
    rowKey: (row) => (row.id !== undefined && row.id !== null ? String(row.id) : JSON.stringify(row)),
    pageSize: r.page_size && r.page_size > 0 ? r.page_size : 10,
  });

  const create = k.create && r.can && r.can.create ? card({ body: createForm(client, token, k.create) }) : "";
  return html`<div class="res" data-resource=${r.resource}>
    ${create}${table}
    <div class="rowmsg muted">${() => msg()}</div>
  </div>`;
}

/** An operation form for an operations-only resource (no `list` op). */
function operationForm(client: Client, token: TokenAccessor, method: string, path: string): TemplateResult {
  const out = signal("");
  const onSubmit = (ev: Event): void => {
    ev.preventDefault();
    const m = method.toUpperCase();
    const body = m === "GET" ? undefined : collectForm(ev.target as Element);
    out.set("…");
    callOp(client, m, path, body, token())
      .then(() => out.set("ok"))
      .catch((e: unknown) => out.set("failed: " + String(e)));
  };
  return html`<form class="op" @submit=${onSubmit}>
    <div class="sig"><span class="m">${method.toUpperCase()}</span><span class="path">${path}</span></div>
    <button type="submit" class="dx-btn">Send</button>
    <div class="out">${() => out()}</div>
  </form>`;
}

/** An operations-only resource: forms for the operations the caller may invoke. */
function opsResource(
  client: Client,
  token: TokenAccessor,
  r: AdminResource,
  spec: OpenApiSpec,
): TemplateResult {
  const forms: TemplateResult[] = [];
  for (const { method, path } of opsForResource(spec, r.resource)) {
    const isWrite = method !== "get";
    // Hide write operations the caller lacks; the server still enforces.
    if (isWrite && !(r.can && (r.can.create || r.can.change))) continue;
    forms.push(operationForm(client, token, method, path));
  }
  return html`<div class="res" data-resource=${r.resource}>
    ${card({
      title: r.label,
      body: forms.length ? html`${forms}` : html`<div class="op muted">No operations available to you for this resource.</div>`,
    })}
  </div>`;
}

/** Pick the table UI (list op + can.view) or the operation-forms UI. */
function renderResource(
  client: Client,
  token: TokenAccessor,
  r: AdminResource,
  spec: OpenApiSpec,
): TemplateResult {
  const k = classifyOps(spec, r.resource);
  if (k.list && r.can && r.can.view) return dataResource(client, token, r, k);
  return opsResource(client, token, r, spec);
}

/** The Seiva admin console as a dxjs component, built on @dxjs/ui. */
export const SeivaConsole = component<{ client: Client }>((props) => {
  const token = signal("");
  const intro = signal("Loading the service contract…");
  const spec = signal<OpenApiSpec>({ paths: {} });
  const resources = signal<AdminResource[]>([]);
  const activeKey = signal("");

  // The selected resource, defaulting to the first one the caller may administer.
  const active = computed<AdminResource | null>(() => {
    const rs = resources();
    return rs.find((r) => resKey(r) === activeKey()) ?? rs[0] ?? null;
  });

  const load = (): void => {
    Promise.all([loadRegistry(props.client, token()), loadSpec(props.client)])
      .then(([reg, sp]) => {
        spec.set(sp);
        const rs = (reg && reg.resources) || [];
        resources.set(rs);
        intro.set(
          rs.length
            ? `${rs.length} resource(s) you may administer.`
            : "No resources are registered for you. A module appears here when it registers an admin resource and you hold its view permission.",
        );
      })
      .catch((e: unknown) => {
        resources.set([]);
        intro.set("could not load the console: " + String(e));
      });
  };

  // Re-run on token change so entering a token reveals the authorized resources.
  const onTokenChange = (ev: Event): void => {
    token.set((ev.target as HTMLInputElement).value.trim());
    load();
  };

  onMount(() => {
    load();
  });

  // The sidebar: one entry per resource, the active one highlighted.
  const nav = (): { label: string; active: boolean; onSelect: () => void }[] =>
    resources().map((r) => ({
      label: r.label,
      active: !!active() && resKey(active()!) === resKey(r),
      onSelect: () => activeKey.set(resKey(r)),
    }));

  // The token field lives in the shell top bar (persistent across resource
  // switches). It reuses the `.dx-search` styling; its id is `#token` for parity
  // with the inline console and the E2E harness.
  const tokenBar = html`<div class="dx-search">
    <input id="token" @change=${onTokenChange} placeholder="Bearer token (for guarded operations)" autocomplete="off" />
  </div>`;

  const content = (): TemplateResult => {
    const r = active();
    return html`
      <h1 class="dx-h1">Seiva Admin</h1>
      <p class="dx-sub muted" id="intro">${() => intro()}</p>
      ${statGrid([
        { label: "Resources", value: () => String(resources().length), tone: "mut" },
        { label: "Viewable", value: () => String(resources().filter((x) => x.can && x.can.view).length), tone: "pos" },
        { label: "Writable", value: () => String(resources().filter((x) => x.can && (x.can.create || x.can.change)).length), tone: "mut" },
      ])}
      <div id="resources">${r ? renderResource(props.client, () => token(), r, spec()) : ""}</div>
    `;
  };

  return appShell({
    brand: "Seiva Admin",
    nav,
    user: { name: "Console", initials: "SA" },
    topbar: tokenBar,
    content,
  });
});
