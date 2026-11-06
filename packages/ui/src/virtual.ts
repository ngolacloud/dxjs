// @dxjs/ui/virtual — list virtualization (the dxjs answer to @tanstack/react-virtual).
//
// Renders only the rows in (and near) the viewport, so a 100k-row list keeps a
// handful of DOM nodes. Fixed row height (v1). All dynamic sizing is applied via
// the CSSOM (element.style set by JS) — which a strict CSP does NOT restrict — so
// there are no inline style attributes and no eval. Static layout lives in ui.css.

import { signal, effect, onCleanup, type Accessor } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { onMount } from "@dxjs/component";

type Maybe<T> = T | Accessor<T>;
const read = <T,>(v: Maybe<T>): T => (typeof v === "function" ? (v as () => T)() : v);

export interface VirtualListOptions<T> {
  rows: Maybe<T[]>;
  /** Fixed row height in px. */
  rowHeight: number;
  /** Viewport height in px (the scroll window). */
  height: number;
  key: (row: T, index: number) => string | number;
  render: (row: T, index: number) => TemplateResult;
  /** Extra rows rendered above/below the viewport (default 4). */
  overscan?: number;
}

export interface VisibleRange {
  start: number;
  end: number; // exclusive
}

/**
 * Pure windowing math: the row index range to render for a given scroll position.
 * Exported so it is unit-testable without a layout engine.
 */
export function visibleRange(
  scrollTop: number,
  rowHeight: number,
  viewportHeight: number,
  count: number,
  overscan = 4,
): VisibleRange {
  if (count === 0 || rowHeight <= 0) return { start: 0, end: 0 };
  const first = Math.floor(scrollTop / rowHeight);
  const visible = Math.ceil(viewportHeight / rowHeight);
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + visible + overscan);
  return { start, end };
}

let seq = 0;

/** A virtualized list. Use in component context (its `onMount` wires scrolling). */
export function virtualList<T>(o: VirtualListOptions<T>): TemplateResult {
  const id = `dxv${seq++}`;
  const scrollTop = signal(0);
  const overscan = o.overscan ?? 4;
  const rows = (): T[] => read(o.rows);
  const range = (): VisibleRange => visibleRange(scrollTop(), o.rowHeight, o.height, rows().length, overscan);
  const windowed = (): Array<{ row: T; index: number }> => {
    const { start, end } = range();
    const all = rows();
    const out: Array<{ row: T; index: number }> = [];
    for (let i = start; i < end; i++) out.push({ row: all[i] as T, index: i });
    return out;
  };

  onMount(() => {
    const vp = document.querySelector(`[data-dxv="${id}"]`) as HTMLElement | null;
    if (!vp) return;
    const sizer = vp.querySelector(".dx-vlist-sizer") as HTMLElement;
    const win = vp.querySelector(".dx-vlist-win") as HTMLElement;
    // Static-per-instance sizing via the CSSOM (CSP-safe; not an inline attribute).
    vp.style.height = `${o.height}px`;
    win.style.setProperty("--dxv-h", `${o.rowHeight}px`);
    const onScroll = (): void => scrollTop.set(vp.scrollTop);
    vp.addEventListener("scroll", onScroll, { passive: true });
    // Keep the scroll range (sizer height) and window offset in sync reactively.
    const stop = effect(() => {
      sizer.style.height = `${rows().length * o.rowHeight}px`;
      win.style.transform = `translateY(${range().start * o.rowHeight}px)`;
    });
    onCleanup(() => {
      vp.removeEventListener("scroll", onScroll);
      stop();
    });
  });

  return html`<div class="dx-vlist" data-dxv=${id}>
    <div class="dx-vlist-sizer"></div>
    <div class="dx-vlist-win">${list(
      () => windowed(),
      (w) => o.key(w.row, w.index),
      (w) => html`<div class="dx-vlist-row">${o.render(w.row, w.index)}</div>`,
    )}</div>
  </div>`;
}
