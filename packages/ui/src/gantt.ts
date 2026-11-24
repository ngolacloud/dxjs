// @dxjs/ui/gantt — a compact horizontal timeline of tasks. Each bar is an inline
// <svg> whose <rect> x/width are PERCENTAGES of the overall day-range, set as SVG
// ATTRIBUTES (never an inline style=), so the geometry stays out of `style-src`
// and the chart is CSP-safe. Pure `barGeom` exported so the math is testable.

import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, type Maybe, type Tone } from "./base.ts";

const DAY_MS = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Parse an ISO "YYYY-MM-DD" into a whole-day number (UTC midnight / 86400000). */
const toDay = (iso: string): number => {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1) / DAY_MS);
};

/** Format a (possibly fractional) day-number as "MMM D" (UTC). */
const fmtDay = (day: number): string => {
  const dt = new Date(Math.round(day) * DAY_MS);
  return `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}`;
};

/** Bar geometry as PERCENTAGES (0..100) of a day-range. Pure + testable. */
export function barGeom(
  rangeStart: string,
  rangeEnd: string,
  taskStart: string,
  taskEnd: string,
): { x: number; width: number } {
  const rs = toDay(rangeStart);
  const span = toDay(rangeEnd) - rs || 1;
  const ts = toDay(taskStart);
  const te = toDay(taskEnd);
  const x = ((ts - rs) / span) * 100;
  const width = ((te - ts) / span) * 100;
  return { x: Math.max(0, x), width: Math.max(0, width) };
}

export interface GanttTask {
  id: string;
  label: string;
  start: string;
  end: string;
  tone?: Tone;
  /** 0..100 completion; draws a second, inner rect. */
  progress?: number;
}

export interface GanttOptions {
  tasks: Maybe<GanttTask[]>;
  /** Overall range start/end (ISO). Default = min start / max end of tasks. */
  start?: string;
  end?: string;
  ariaLabel?: string;
}

const H = 16;

/** The resolved [startISO, endISO] range for the current task set. */
function rangeOf(tasks: GanttTask[], start?: string, end?: string): [string, string] {
  if (start && end) return [start, end];
  if (tasks.length === 0) return [start ?? "1970-01-01", end ?? "1970-01-02"];
  let lo = tasks[0]!.start;
  let hi = tasks[0]!.end;
  for (const t of tasks) {
    if (toDay(t.start) < toDay(lo)) lo = t.start;
    if (toDay(t.end) > toDay(hi)) hi = t.end;
  }
  return [start ?? lo, end ?? hi];
}

/** Evenly spaced axis ticks (positions in %, labels "MMM D"). */
function ticksOf(rStart: string, rEnd: string): Array<{ pos: number; label: string }> {
  const rs = toDay(rStart);
  const span = toDay(rEnd) - rs || 1;
  const n = Math.min(span, 10);
  const out: Array<{ pos: number; label: string }> = [];
  for (let i = 0; i <= n; i++) {
    out.push({ pos: (i / n) * 100, label: fmtDay(rs + (span * i) / n) });
  }
  return out;
}

/** A horizontal Gantt timeline. Bars are percentage-positioned SVG rects. */
export function gantt(o: GanttOptions): TemplateResult {
  const range = (): [string, string] => rangeOf(read(o.tasks), o.start, o.end);

  const bar = (t: GanttTask): TemplateResult => {
    const [rs, re] = range();
    const g = barGeom(rs, re, t.start, t.end);
    const prog = t.progress != null ? Math.max(0, Math.min(100, t.progress)) : null;
    return html`<div class="dx-gantt-row" role="row">
      <div class="dx-gantt-name" role="rowheader" title=${t.label}>${t.label}</div>
      <div class="dx-gantt-cell" role="gridcell">
        <svg class="dx-gantt-track" viewBox=${`0 0 100 ${H}`} preserveAspectRatio="none" role="img" aria-label=${`${t.label}: ${t.start} to ${t.end}`}>
          <rect class=${cx("dx-gantt-bar", t.tone && `is-${t.tone}`)} x=${g.x} y="3" width=${g.width} height=${H - 6} rx="2"></rect>
          ${prog != null
            ? html`<rect class="dx-gantt-prog" x=${g.x} y="3" width=${(g.width * prog) / 100} height=${H - 6} rx="2"></rect>`
            : ""}
        </svg>
      </div>
    </div>`;
  };

  const axis = (): TemplateResult => {
    const ts = ticksOf(...range());
    return html`<svg class="dx-gantt-axis" viewBox=${`0 0 100 ${H}`} preserveAspectRatio="none" aria-hidden="true">${ts.map(
      (t) => html`<line class="dx-gantt-tick" x1=${t.pos} y1="0" x2=${t.pos} y2=${H}></line>`,
    )}</svg>`;
  };
  const labels = (): TemplateResult => {
    const ts = ticksOf(...range());
    return html`<div class="dx-gantt-labels">${ts.map((t) => html`<span class="dx-gantt-lbl">${t.label}</span>`)}</div>`;
  };

  return html`<div class="dx-gantt" role="grid" aria-label=${o.ariaLabel ?? "Timeline"}>
    <div class="dx-gantt-head" role="row">
      <div class="dx-gantt-name dx-gantt-corner" role="columnheader"></div>
      <div class="dx-gantt-cell" role="columnheader">${() => axis()}${() => labels()}</div>
    </div>
    ${list(() => read(o.tasks), (t) => t.id, bar)}
  </div>`;
}
