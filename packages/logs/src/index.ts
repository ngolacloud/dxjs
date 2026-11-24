// @dxjs/logs — a virtualized, multi-source log viewer for the Cloud Shell.
//
// Lines arrive from many sources (append()), are merged in time order, and are
// filtered reactively by minimum level, active sources and a text query. Only the
// visible window is rendered — it reuses @dxjs/ui's virtualList — so a viewer with
// tens of thousands of lines keeps a handful of DOM nodes. Text goes through the
// safe textContent sink (escaped); layout is classes only → strict-CSP safe.

import { signal, computed, type Accessor } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { virtualList } from "@dxjs/ui";

export type LogLevel = "debug" | "info" | "warn" | "error";
const RANK: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

export interface LogLine {
  ts: number;
  source: string;
  level: LogLevel;
  text: string;
}

export interface LogViewerOptions {
  /** Ring-buffer cap; oldest lines drop off. Default 10000. */
  maxLines?: number;
  /** Fixed row height in px (for virtualization). Default 22. */
  rowHeight?: number;
  /** Viewport height in px. Default 480. */
  height?: number;
  /** "time" sorts by ts across sources; "arrival" keeps append order. Default "time". */
  order?: "time" | "arrival";
}

export interface LogViewer {
  /** Ingest one or more lines from any source. */
  append(line: LogLine | LogLine[]): void;
  /** Reactive, filtered + ordered lines (the model the view renders). */
  lines: Accessor<LogLine[]>;
  /** Distinct source names seen so far (reactive). */
  sources: Accessor<string[]>;
  /** Keep only lines at or above `level`. */
  setMinLevel(level: LogLevel): void;
  /** Restrict to these sources (null/empty = all). */
  setSources(active: string[] | null): void;
  /** Case-insensitive substring filter over the text. */
  setQuery(q: string): void;
  /** Drop every line. */
  clear(): void;
  /** The virtualized view (use in component context). */
  view(): TemplateResult;
}

export function createLogViewer(options: LogViewerOptions = {}): LogViewer {
  const maxLines = options.maxLines ?? 10000;
  const rowHeight = options.rowHeight ?? 22;
  const height = options.height ?? 480;
  const order = options.order ?? "time";

  const raw = signal<LogLine[]>([]);
  const minLevel = signal<LogLevel>("debug");
  const activeSources = signal<Set<string> | null>(null);
  const query = signal("");

  let buffer: LogLine[] = [];

  const append = (line: LogLine | LogLine[]): void => {
    const incoming = Array.isArray(line) ? line : [line];
    if (incoming.length === 0) return;
    buffer = buffer.concat(incoming);
    if (order === "time") buffer.sort((a, b) => a.ts - b.ts);
    if (buffer.length > maxLines) buffer = buffer.slice(buffer.length - maxLines);
    raw.set(buffer.slice());
  };

  const sources = computed<string[]>(() => {
    const seen = new Set<string>();
    for (const l of raw()) seen.add(l.source);
    return [...seen].sort();
  });

  const lines = computed<LogLine[]>(() => {
    const min = RANK[minLevel()];
    const active = activeSources();
    const q = query().trim().toLowerCase();
    return raw().filter(
      (l) =>
        RANK[l.level] >= min &&
        (!active || active.size === 0 || active.has(l.source)) &&
        (!q || l.text.toLowerCase().includes(q)),
    );
  });

  const view = (): TemplateResult =>
    virtualList<LogLine>({
      rows: () => lines(),
      rowHeight,
      height,
      key: (_row, index) => index,
      render: (l) => html`<div class=${"dx-log-row is-" + l.level}>
        <span class="dx-log-src">${l.source}</span>
        <span class="dx-log-lvl">${l.level}</span>
        <span class="dx-log-txt">${l.text}</span>
      </div>`,
    });

  return {
    append,
    lines: () => lines(),
    sources: () => sources(),
    setMinLevel: (level) => minLevel.set(level),
    setSources: (active) => activeSources.set(active && active.length ? new Set(active) : null),
    setQuery: (q) => query.set(q),
    clear: () => {
      buffer = [];
      raw.set([]);
    },
    view,
  };
}
