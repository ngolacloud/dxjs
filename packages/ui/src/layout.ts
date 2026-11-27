// @dxjs/ui/layout — primitive layout containers: a flex `stack`, a CSS `grid`, a
// `space` spacer and a resizable `splitter`. Class-only styling (CSP-safe): the
// look lives in CSS and components only toggle classes. The one piece of dynamic
// geometry — the splitter ratio and the grid column count — rides a CSS custom
// property set through a `ref` effect, never an inline `style=` attribute. The
// splitter drags through pointer capture on its own handle (no document-level
// listeners) and releases that capture on cleanup.

import { signal, onCleanup } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { cx, resolveSize, type Size } from "./base.ts";
import { icon } from "./icons.ts";

/** Map a Size (tier or 1–6) to the `--dx-gap` setter class. */
const gapClass = (s?: Size): string => (s === undefined ? "" : `dx-gap-${resolveSize(s)}`);

// --- Stack -----------------------------------------------------------------
export type StackAlign = "start" | "center" | "end" | "stretch" | "baseline";
export type StackJustify = "start" | "center" | "end" | "between" | "around" | "evenly";

export interface StackOptions {
  children: TemplateResult[] | TemplateResult;
  /** Gap between children (maps to a --dx-space-* token). */
  gap?: Size;
  /** Main axis (default "col"). */
  direction?: "row" | "col";
  /** align-items. */
  align?: StackAlign;
  /** justify-content. */
  justify?: StackJustify;
  /** Allow wrapping onto multiple lines. */
  wrap?: boolean;
}

/** A flex container. Vertical by default; set `direction: "row"` for a row. */
export function stack(o: StackOptions): TemplateResult {
  const cls = cx(
    "dx-stack",
    o.direction === "row" ? "is-row" : "is-col",
    gapClass(o.gap),
    o.align && `is-align-${o.align}`,
    o.justify && `is-justify-${o.justify}`,
    o.wrap && "is-wrap",
  );
  return html`<div class=${cls}>${o.children}</div>`;
}

// --- Grid ------------------------------------------------------------------
export interface GridOptions {
  children: TemplateResult[] | TemplateResult;
  /** Fixed column count (default 2). Ignored when `minCol` is set. */
  cols?: number;
  gap?: Size;
  /** Minimum column width in px. Enables a responsive auto-fit grid:
   *  repeat(auto-fit, minmax(minCol, 1fr)). */
  minCol?: number;
}

/** A CSS grid. Fixed `cols`, or responsive auto-fit when `minCol` is given. */
export function grid(o: GridOptions): TemplateResult {
  const auto = o.minCol !== undefined;
  const setVars = (el: Element): void => {
    const s = el as HTMLElement;
    if (auto) s.style.setProperty("--dx-grid-min", `${o.minCol}px`);
    else s.style.setProperty("--dx-grid-cols", String(o.cols ?? 2));
  };
  return html`<div class=${cx("dx-grid", auto && "is-auto", gapClass(o.gap))} ref=${setVars}>${o.children}</div>`;
}

// --- Space -----------------------------------------------------------------
/** A fixed spacer of `size` (default "md"), useful between stack items. */
export function space(size?: Size): TemplateResult {
  return html`<div class=${cx("dx-space", `dx-gap-${resolveSize(size)}`)} aria-hidden="true"></div>`;
}

// --- Splitter --------------------------------------------------------------
export interface SplitterOptions {
  start: TemplateResult;
  end: TemplateResult;
  /** Pane arrangement (default "horizontal" = side by side). */
  direction?: "horizontal" | "vertical";
  /** Initial split ratio 0..1 (default 0.5). */
  initial?: number;
  /** Minimum size of each pane in px (clamps the ratio while dragging). */
  min?: number;
}

/** Two resizable panes with a draggable divider. The split ratio is a CSS custom
 *  property (`--dx-split`) set via a ref + pointer capture on the handle — no
 *  inline styles, no document listeners. The divider is a role="separator" with
 *  aria-orientation + aria-valuenow; Arrow keys (Left/Right or Up/Down) nudge the
 *  ratio, Home/End snap it to the edges. */
export function splitter(o: SplitterOptions): TemplateResult {
  const vertical = o.direction === "vertical";
  const clamp = (r: number): number => Math.min(1, Math.max(0, r));
  const ratio = signal(clamp(o.initial ?? 0.5));

  let rootEl: HTMLElement | null = null;
  let sepEl: HTMLElement | null = null;
  let pid: number | null = null;
  const STEP = 0.02;

  const applyVar = (): void => {
    rootEl?.style.setProperty("--dx-split", String(ratio()));
  };
  const setRatio = (r: number): void => {
    ratio.set(clamp(r));
    applyVar();
  };

  const setRoot = (el: Element): void => {
    rootEl = el as HTMLElement;
    applyVar();
  };
  const setSep = (el: Element): void => {
    sepEl = el as HTMLElement;
  };

  const fromPointer = (e: PointerEvent): void => {
    if (!rootEl) return;
    const rect = rootEl.getBoundingClientRect();
    const total = vertical ? rect.height : rect.width;
    if (total <= 0) return;
    const pos = vertical ? e.clientY - rect.top : e.clientX - rect.left;
    let r = pos / total;
    if (o.min !== undefined) {
      const m = o.min / total;
      r = Math.min(1 - m, Math.max(m, r));
    }
    setRatio(r);
  };

  const onDown = (e: PointerEvent): void => {
    const h = e.currentTarget as HTMLElement;
    pid = e.pointerId;
    h.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent): void => {
    if (pid === null) return;
    fromPointer(e);
  };
  const onUp = (e: PointerEvent): void => {
    const h = e.currentTarget as HTMLElement;
    if (pid !== null) h.releasePointerCapture?.(pid);
    pid = null;
  };

  const onKey = (e: KeyboardEvent): void => {
    const dec = vertical ? "ArrowUp" : "ArrowLeft";
    const inc = vertical ? "ArrowDown" : "ArrowRight";
    if (e.key === dec) {
      e.preventDefault();
      setRatio(ratio() - STEP);
    } else if (e.key === inc) {
      e.preventDefault();
      setRatio(ratio() + STEP);
    } else if (e.key === "Home") {
      e.preventDefault();
      setRatio(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setRatio(1);
    }
  };

  // Deterministic teardown: release any live pointer capture on the handle.
  onCleanup(() => {
    if (sepEl && pid !== null) sepEl.releasePointerCapture?.(pid);
    pid = null;
  });

  return html`<div class=${cx("dx-split", vertical ? "is-vertical" : "is-horizontal")} ref=${setRoot}>
    <div class="dx-split-pane is-start">${o.start}</div>
    <div
      class="dx-split-sep"
      role="separator"
      tabindex="0"
      aria-orientation=${vertical ? "horizontal" : "vertical"}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow=${() => String(Math.round(ratio() * 100))}
      ref=${setSep}
      @pointerdown=${onDown}
      @pointermove=${onMove}
      @pointerup=${onUp}
      @keydown=${onKey}
    ><span class="dx-split-grip" aria-hidden="true">${icon("grip", { size: 16 })}</span></div>
    <div class="dx-split-pane is-end">${o.end}</div>
  </div>`;
}
