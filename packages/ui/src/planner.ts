// @dxjs/ui/planner — a weekly agenda grid: a time gutter (hour rows) + 7 day
// columns. Each event block is positioned by top/height PERCENTAGES of the
// visible hour span, applied through CSS custom properties with a `ref` effect
// (`el.style.setProperty("--dx-ev-top", …)`) — never a `style=` attribute — so it
// stays CSP-safe. Pure `eventGeom` exported so the math is testable.

import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, type Maybe, type Tone } from "./base.ts";

/** Parse "HH:MM" into minutes-from-midnight. */
const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** Event block geometry as PERCENTAGES of the visible [startHour, endHour] span. */
export function eventGeom(
  startHour: number,
  endHour: number,
  evStart: string,
  evEnd: string,
): { top: number; height: number } {
  const spanMin = (endHour - startHour) * 60 || 1;
  const base = startHour * 60;
  const s = toMin(evStart) - base;
  const e = toMin(evEnd) - base;
  return { top: (s / spanMin) * 100, height: ((e - s) / spanMin) * 100 };
}

export interface PlannerEvent {
  id: string;
  /** 0..6, absolute day of week (0 = Sunday). */
  day: number;
  /** "HH:MM". */
  start: string;
  end: string;
  title: string;
  tone?: Tone;
}

export interface PlannerOptions {
  events: Maybe<PlannerEvent[]>;
  /** First column: 0 = Sunday (default), 1 = Monday. */
  weekStart?: 0 | 1;
  /** 7 day names, indexed by absolute day (0 = Sunday). Localizable. */
  dayLabels?: string[];
  startHour?: number;
  endHour?: number;
  onSelect?: (id: string) => void;
}

const DEFAULT_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad2 = (n: number): string => (n < 10 ? `0${n}` : `${n}`);

/** A weekly agenda (7 day columns × hour rows) with positioned event blocks. */
export function planner(o: PlannerOptions): TemplateResult {
  const startHour = o.startHour ?? 7;
  const endHour = o.endHour ?? 19;
  const labels = o.dayLabels ?? DEFAULT_LABELS;
  const order = o.weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];

  const hours: number[] = [];
  for (let h = startHour; h <= endHour; h++) hours.push(h);

  const block = (ev: PlannerEvent): TemplateResult => {
    const g = eventGeom(startHour, endHour, ev.start, ev.end);
    const setVars = (el: Element): void => {
      const s = (el as HTMLElement).style;
      s.setProperty("--dx-ev-top", `${g.top}%`);
      s.setProperty("--dx-ev-height", `${g.height}%`);
    };
    return html`<button
      class=${cx("dx-plan-ev", ev.tone && `is-${ev.tone}`)}
      ref=${setVars}
      @click=${() => o.onSelect?.(ev.id)}
    >
      <span class="dx-plan-ev-time">${ev.start}–${ev.end}</span>
      <span class="dx-plan-ev-title">${ev.title}</span>
    </button>`;
  };

  const column = (day: number): TemplateResult =>
    html`<div class="dx-plan-col" role="gridcell" data-day=${day}>
      ${hours.map(() => html`<div class="dx-plan-slot" aria-hidden="true"></div>`)}
      ${list(
        () => read(o.events).filter((e) => e.day === day),
        (e) => e.id,
        block,
      )}
    </div>`;

  return html`<div class="dx-plan" role="grid" aria-label="Weekly agenda">
    <div class="dx-plan-head" role="row">
      <div class="dx-plan-gutter-head" role="columnheader"></div>
      ${order.map((d) => html`<div class="dx-plan-col-head" role="columnheader">${labels[d]}</div>`)}
    </div>
    <div class="dx-plan-body">
      <div class="dx-plan-gutter">
        ${hours.map((h) => html`<div class="dx-plan-hour">${pad2(h)}:00</div>`)}
      </div>
      ${order.map(column)}
    </div>
  </div>`;
}
