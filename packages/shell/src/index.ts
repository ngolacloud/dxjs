// @dxjs/shell — Cloud Shell interaction primitives: a command palette, idempotent
// toasts, and a topology-graph builder over @dxjs/canvas. All CSP-safe (classes +
// @event listeners, escaped text — no eval, no inline handlers).

import { signal, type Accessor } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { createGraph, type Graph } from "@dxjs/canvas";

// --- Command palette -------------------------------------------------------
export interface Command {
  id: string;
  title: string;
  /** Extra text matched by the query (synonyms, path). */
  keywords?: string;
  group?: string;
  run: () => void;
}

export interface CommandPalette {
  open: Accessor<boolean>;
  query: Accessor<string>;
  /** Commands matching the current query (substring over title + keywords). */
  results: Accessor<Command[]>;
  /** Index of the highlighted result. */
  active: Accessor<number>;
  show(): void;
  hide(): void;
  toggle(): void;
  setQuery(q: string): void;
  /** Move the highlight by `delta`, clamped to the result range. */
  moveSelection(delta: number): void;
  /** Hide, then execute the highlighted command (if any). */
  runActive(): void;
  view(): TemplateResult;
}

export function createCommandPalette(commands: Command[]): CommandPalette {
  const openSig = signal(false);
  const querySig = signal("");
  const activeSig = signal(0);

  const results = (): Command[] => {
    const q = querySig().trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => (c.title + " " + (c.keywords ?? "")).toLowerCase().includes(q));
  };

  const setQuery = (q: string): void => {
    querySig.set(q);
    activeSig.set(0); // a new query resets the highlight to the top
  };
  const moveSelection = (delta: number): void => {
    const n = results().length;
    if (n === 0) return;
    activeSig.set(Math.max(0, Math.min(n - 1, activeSig() + delta)));
  };
  const runCommand = (c: Command): void => {
    openSig.set(false);
    c.run();
  };
  const runActive = (): void => {
    const c = results()[activeSig()];
    if (c) runCommand(c);
  };

  const onKey = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.key === "ArrowDown") {
      ev.preventDefault();
      moveSelection(1);
    } else if (ev.key === "ArrowUp") {
      ev.preventDefault();
      moveSelection(-1);
    } else if (ev.key === "Enter") {
      ev.preventDefault();
      runActive();
    } else if (ev.key === "Escape") {
      openSig.set(false);
    }
  };

  const view = (): TemplateResult => html`<div class="dx-cmdk" role="dialog" aria-label="Command palette" ?hidden=${() =>
    !openSig()}>
    <input
      class="dx-cmdk-input"
      aria-label="Type a command"
      autocomplete="off"
      .value=${() => querySig()}
      @input=${(e: Event) => setQuery((e.target as HTMLInputElement).value)}
      @keydown=${onKey}
    />
    <ul class="dx-cmdk-list" role="listbox">
      ${list(
        () => results(),
        (c) => c.id,
        (c, i) =>
          html`<li
            class=${() => "dx-cmdk-item" + (activeSig() === i ? " is-active" : "")}
            role="option"
            aria-selected=${() => (activeSig() === i ? "true" : "false")}
            @click=${() => runCommand(c)}
          >${c.title}</li>`,
      )}
    </ul>
  </div>`;

  return {
    open: () => openSig(),
    query: () => querySig(),
    results,
    active: () => activeSig(),
    show: () => {
      openSig.set(true);
      setQuery("");
    },
    hide: () => openSig.set(false),
    toggle: () => {
      const next = !openSig();
      openSig.set(next);
      if (next) setQuery("");
    },
    setQuery,
    moveSelection,
    runActive,
    view,
  };
}

// --- Idempotent toasts -----------------------------------------------------
export type ToastLevel = "info" | "success" | "warn" | "error";

export interface Toast {
  /** Idempotency key: a repeat notify() with the same key UPDATES in place. */
  key: string;
  level: ToastLevel;
  text: string;
}

export interface Toaster {
  toasts: Accessor<Toast[]>;
  /** Show a toast. If one with the same key exists, it is UPDATED in place
   *  (no duplicate) — safe to call from a retrying operation. */
  notify(toast: Toast): void;
  dismiss(key: string): void;
  clear(): void;
  view(): TemplateResult;
}

export function createToaster(): Toaster {
  const toastsSig = signal<Toast[]>([]);

  const notify = (toast: Toast): void => {
    const cur = toastsSig();
    const i = cur.findIndex((t) => t.key === toast.key);
    if (i >= 0) {
      const next = cur.slice();
      next[i] = toast; // update in place → idempotent, no second toast
      toastsSig.set(next);
    } else {
      toastsSig.set([...cur, toast]);
    }
  };

  const dismiss = (key: string): void => {
    toastsSig.set(toastsSig().filter((t) => t.key !== key));
  };

  const view = (): TemplateResult => html`<div class="dx-toasts" role="region" aria-label="Notifications">
    ${list(
      () => toastsSig(),
      (t) => t.key,
      (t) => html`<div class=${"dx-toast is-" + t.level} role="status">
        <span class="dx-toast-text">${t.text}</span>
        <button class="dx-toast-x" aria-label="Dismiss" @click=${() => dismiss(t.key)}>×</button>
      </div>`,
    )}
  </div>`;

  return {
    toasts: () => toastsSig(),
    notify,
    dismiss,
    clear: () => toastsSig.set([]),
    view,
  };
}

// --- Topology --------------------------------------------------------------
export interface TopologyService {
  id: string;
  label: string;
}
export interface TopologyLink {
  from: string;
  to: string;
}
export interface TopologyOptions {
  /** Nodes per column before wrapping. Default 4. */
  perColumn?: number;
  colGap?: number;
  rowGap?: number;
}

/** Build a @dxjs/canvas graph from a service topology: one node per service
 *  (laid out in a simple grid) and an edge per link. Invalid links (unknown
 *  endpoints) are skipped. Returns the reactive Graph — render it with
 *  @dxjs/canvas's `draw`. */
export function topologyGraph(
  services: TopologyService[],
  links: TopologyLink[],
  options: TopologyOptions = {},
): Graph {
  const perColumn = options.perColumn ?? 4;
  const colGap = options.colGap ?? 220;
  const rowGap = options.rowGap ?? 110;
  const g = createGraph();
  services.forEach((s, i) => {
    const col = Math.floor(i / perColumn);
    const row = i % perColumn;
    g.addNode({
      id: s.id,
      x: 40 + col * colGap,
      y: 40 + row * rowGap,
      width: 160,
      height: 64,
      label: s.label,
      ports: [
        { id: "in", kind: "in", name: "in" },
        { id: "out", kind: "out", name: "out" },
      ],
    });
  });
  for (const l of links) {
    g.connect({ node: l.from, port: "out" }, { node: l.to, port: "in" });
  }
  return g;
}
