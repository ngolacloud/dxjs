// @dxjs/ui/calendar — a smart month calendar. All date math is in UTC (no timezone
// drift), names/labels are localized via Intl for any `locale`, and holidays come
// from the offline, pluggable engine in ./holidays.ts (so it "knows" Angola's
// public days out of the box). Events are easy to populate: pass [{date,title}].
// Class-only + safe sinks → CSP-safe.

import { signal } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, sizeClass, type Maybe, type Size, type Tone } from "./base.ts";
import { holidaysFor, type Holiday, type HolidayProvider } from "./holidays.ts";

export interface CalendarEvent {
  /** ISO date YYYY-MM-DD. */
  date: string;
  title: string;
  tone?: Tone;
}
export interface CalendarOptions {
  /** Selected date (ISO). */
  value?: Maybe<string>;
  onSelect?: (iso: string) => void;
  /** Called when the visible month changes, with "YYYY-MM". */
  onMonthChange?: (ym: string) => void;
  events?: Maybe<CalendarEvent[]>;
  /** BCP-47 locale for Intl names AND the built-in holiday set. Default "pt-AO". */
  locale?: string;
  /** true = built-in holidays for `locale`; a function = your own provider; false/undefined = none. */
  holidays?: boolean | HolidayProvider;
  /** 0=Sunday (default), 1=Monday. */
  weekStart?: 0 | 1;
  size?: Size;
}

const pad2 = (n: number): string => String(n).padStart(2, "0");
const isoOf = (y: number, m0: number, d: number): string => `${y}-${pad2(m0 + 1)}-${pad2(d)}`;
const dowOf = (y: number, m0: number, d: number): number => new Date(Date.UTC(y, m0, d)).getUTCDay();
const daysIn = (y: number, m0: number): number => new Date(Date.UTC(y, m0 + 1, 0)).getUTCDate();

/** Localised weekday short names, rotated to `weekStart`. */
function weekdayNames(locale: string, weekStart: 0 | 1): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" });
  // 1970-01-04 is a Sunday (UTC); offset by the weekday index.
  const names = Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(1970, 0, 4 + i))));
  return names.slice(weekStart).concat(names.slice(0, weekStart));
}

export function calendar(o: CalendarOptions): TemplateResult {
  const locale = o.locale ?? "pt-AO";
  const weekStart = o.weekStart ?? 0;
  const today = new Date();
  const todayIso = isoOf(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const seed = (): [number, number] => {
    const v = read(o.value ?? "");
    const m = /^(\d{4})-(\d{2})/.exec(v);
    if (m) return [+m[1]!, +m[2]! - 1];
    return [today.getUTCFullYear(), today.getUTCMonth()];
  };
  const [sy, sm] = seed();
  const viewY = signal(sy);
  const viewM = signal(sm);

  const move = (delta: number): void => {
    let m = viewM() + delta;
    let y = viewY();
    if (m < 0) {
      m = 11;
      y--;
    } else if (m > 11) {
      m = 0;
      y++;
    }
    viewM.set(m);
    viewY.set(y);
    o.onMonthChange?.(`${y}-${pad2(m + 1)}`);
  };

  const holidayIndex = (): Map<string, Holiday> => {
    if (!o.holidays) return new Map();
    const list2 = typeof o.holidays === "function" ? o.holidays(viewY()) : holidaysFor(locale, viewY());
    const map = new Map<string, Holiday>();
    for (const h of list2) map.set(h.date, h);
    return map;
  };
  const eventsByDate = (): Map<string, CalendarEvent[]> => {
    const map = new Map<string, CalendarEvent[]>();
    for (const e of read(o.events ?? [])) (map.get(e.date) ?? map.set(e.date, []).get(e.date)!).push(e);
    return map;
  };

  const titleFmt = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric", timeZone: "UTC" });
  const weekdays = weekdayNames(locale, weekStart);

  const cells = (): Array<number | null> => {
    const y = viewY();
    const m = viewM();
    const lead = (dowOf(y, m, 1) - weekStart + 7) % 7;
    const out: Array<number | null> = [];
    for (let i = 0; i < lead; i++) out.push(null);
    for (let d = 1; d <= daysIn(y, m); d++) out.push(d);
    return out;
  };

  const dayCell = (d: number | null): TemplateResult => {
    if (d === null) return html`<div class="dx-cal-cell is-empty"></div>`;
    const date = isoOf(viewY(), viewM(), d);
    const hol = holidayIndex().get(date);
    const evs = eventsByDate().get(date) ?? [];
    const cls = (): string =>
      cx(
        "dx-cal-cell",
        read(o.value ?? "") === date && "is-selected",
        date === todayIso && "is-today",
        hol && "is-holiday",
      );
    return html`<button
      class=${cls}
      type="button"
      aria-current=${date === todayIso ? "date" : false}
      aria-pressed=${() => (read(o.value ?? "") === date ? "true" : "false")}
      title=${hol ? hol.name : false}
      @click=${() => o.onSelect?.(date)}
    >
      <span class="dx-cal-num">${String(d)}</span>
      ${hol ? html`<span class="dx-cal-holi" aria-hidden="true"></span>` : ""}
      ${evs.length
        ? html`<span class="dx-cal-evs" aria-hidden="true">${evs.slice(0, 3).map((e) => html`<span class=${cx("dx-cal-ev", e.tone && `is-${e.tone}`)}></span>`)}</span>`
        : ""}
    </button>`;
  };

  return html`<div class=${cx("dx-cal", sizeClass(o.size))}>
    <div class="dx-cal-head">
      <button class="dx-btn is-icon" type="button" aria-label="Previous month" @click=${() => move(-1)}>‹</button>
      <span class="dx-cal-title">${() => titleFmt.format(new Date(Date.UTC(viewY(), viewM(), 1)))}</span>
      <button class="dx-btn is-icon" type="button" aria-label="Next month" @click=${() => move(1)}>›</button>
    </div>
    <div class="dx-cal-grid dx-cal-dow">${weekdays.map((w) => html`<span class="dx-cal-wd">${w}</span>`)}</div>
    <div class="dx-cal-grid">${list(() => cells(), (d, i) => (d === null ? `e${i}` : isoOf(viewY(), viewM(), d)), dayCell)}</div>
  </div>`;
}
