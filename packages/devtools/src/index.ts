// @dxjs/devtools — a signals inspector. It installs a @dxjs/core inspector hook
// and keeps a LIVE, reactive snapshot of the reactive graph: every signal,
// computed and effect created while it is active, with its kind, optional name,
// current value and recompute count. A panel can render `nodes()` reactively;
// here we expose the data (the visual panel/extension is a later increment).
//
// Dev-only: installing an inspector is what makes @dxjs/core allocate inspect
// handles; without devtools the core hot path is a single null check.

import { signal, setInspector, withoutInspector, type Accessor, type InspectNode } from "@dxjs/core";
import { html, render, type TemplateResult } from "@dxjs/dom";

export interface DevtoolsNode {
  id: number;
  kind: "signal" | "computed" | "effect";
  name?: string;
  /** Latest value seen (signals + computeds; effects stay undefined). */
  value?: unknown;
  /** How many times a computed/effect has (re)run; 0 for a plain signal. */
  runs: number;
  disposed: boolean;
}

export interface Devtools {
  /** Reactive snapshot of all tracked nodes (newest insertion order). */
  nodes: Accessor<DevtoolsNode[]>;
  /** Only the nodes still live (not disposed). */
  live: Accessor<DevtoolsNode[]>;
  /** Forget everything captured so far. */
  clear(): void;
  /** Uninstall the inspector (restores the zero-cost core path). */
  stop(): void;
}

/**
 * Install the inspector and start capturing. Call BEFORE creating the signals you
 * want to see. Returns a handle whose `nodes()` is a reactive accessor.
 */
export function createDevtools(): Devtools {
  // Created before setInspector → this signal itself is NOT instrumented (no
  // self-observation / feedback loop).
  const map = new Map<number, DevtoolsNode>();
  const snap = signal<DevtoolsNode[]>([]);
  const publish = (): void => {
    snap.set([...map.values()]);
  };

  setInspector({
    onCreate(n: InspectNode): void {
      map.set(n.id, { id: n.id, kind: n.kind, name: n.name, value: undefined, runs: 0, disposed: false });
      publish();
    },
    onUpdate(n: InspectNode, value: unknown): void {
      const d = map.get(n.id);
      if (d) {
        d.value = value;
        publish();
      }
    },
    onRun(n: InspectNode): void {
      const d = map.get(n.id);
      if (d) {
        d.runs += 1;
        publish();
      }
    },
    onDispose(n: InspectNode): void {
      const d = map.get(n.id);
      if (d) {
        d.disposed = true;
        publish();
      }
    },
  });

  return {
    nodes: () => snap(),
    live: () => snap().filter((n) => !n.disposed),
    clear(): void {
      map.clear();
      publish();
    },
    stop(): void {
      setInspector(null);
    },
  };
}

// --- visual panel ----------------------------------------------------------
type KindFilter = "all" | "signal" | "computed" | "effect";

export interface DevtoolsPanelOptions {
  title?: string;
}

function formatValue(v: unknown): string {
  if (v === undefined) return "—";
  try {
    const s = JSON.stringify(v);
    if (s === undefined) return String(v);
    return s.length > 48 ? s.slice(0, 48) + "…" : s;
  } catch {
    return String(v);
  }
}

/**
 * A live inspector view for a `Devtools` instance, rendered with dxjs itself
 * (dogfooded) — a table of every tracked signal/computed/effect with its value
 * and recompute count, plus kind and hide-disposed filters. Reactive: it
 * re-renders as the graph churns. CSP-safe (classes + @event, escaped text).
 * Mount it anywhere with `render(() => devtoolsPanel(dev), host)`.
 */
export function devtoolsPanel(dev: Devtools, options: DevtoolsPanelOptions = {}): TemplateResult {
  const kind = signal<KindFilter>("all");
  const hideDisposed = signal(false);

  const rows = (): DevtoolsNode[] => {
    const k = kind();
    const hide = hideDisposed();
    return dev.nodes().filter((n) => (k === "all" || n.kind === k) && (!hide || !n.disposed));
  };

  const chip = (k: KindFilter, label: string): TemplateResult =>
    html`<button
      class=${() => "dx-dt-chip" + (kind() === k ? " is-active" : "")}
      data-kind=${k}
      @click=${() => kind.set(k)}
    >${label}</button>`;

  return html`<section class="dx-devtools">
    <header class="dx-dt-bar">
      <strong class="dx-dt-brand">${options.title ?? "dxjs devtools"}</strong>
      <span class="dx-dt-count">${() => rows().length}</span>
      ${chip("all", "All")}${chip("signal", "Signals")}${chip("computed", "Computed")}${chip("effect", "Effects")}
      <label class="dx-dt-toggle"><input
        type="checkbox"
        @change=${(e: Event) => hideDisposed.set((e.target as HTMLInputElement).checked)}
      /> hide disposed</label>
    </header>
    <table class="dx-dt-tbl">
      <thead><tr><th>Kind</th><th>Name</th><th>Value</th><th>Runs</th><th>State</th></tr></thead>
      <tbody>${() =>
        rows().map(
          (n) => html`<tr class=${n.disposed ? "dx-dt-row is-disposed" : "dx-dt-row"}>
            <td class=${"dx-dt-kind is-" + n.kind}>${n.kind}</td>
            <td>${n.name ?? "—"}</td>
            <td class="dx-dt-val">${formatValue(n.value)}</td>
            <td class="dx-num">${n.runs}</td>
            <td>${n.disposed ? "disposed" : "live"}</td>
          </tr>`,
        )}</tbody>
    </table>
  </section>`;
}

/**
 * Mount the devtools panel into `host`. Wraps the render in `withoutInspector`, so
 * the panel's OWN reactive nodes (and its re-renders) stay invisible to the
 * inspector — otherwise the panel would observe itself and loop. Returns a disposer.
 */
export function renderPanel(dev: Devtools, host: Element, options?: DevtoolsPanelOptions): () => void {
  return withoutInspector(() => render(devtoolsPanel(dev, options), host));
}
