// @dxjs/ui/pickers — the rich inputs: a searchable/multi select (select2-style),
// a calendar date picker, and a countdown/stopwatch timer. Self-contained state
// via @dxjs/core signals; class-only styling; CSP-safe (no inline styles/handlers,
// no eval). Dropdowns close on focus leaving the root (focusout) — no document
// listeners to leak.

import { signal, onCleanup } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, nextId, cx, sizeClass, type Maybe, type Size } from "./base.ts";

// --- Searchable / multi select (select2-style) -----------------------------
export interface Select2Option {
  value: string;
  label: string;
}
export interface Select2Options {
  options: Maybe<Select2Option[]>;
  /** A single value (single mode) or an array (when `multiple`). */
  value?: Maybe<string | string[]>;
  multiple?: boolean;
  onChange?: (value: string | string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  size?: Size;
  ariaLabel?: string;
}

/** A combobox with type-to-filter and single or multi selection. */
export function searchableSelect(o: Select2Options): TemplateResult {
  const open = signal(false);
  const query = signal("");
  const opts = (): Select2Option[] => read(o.options);
  const selected = (): string[] => {
    const v = read(o.value ?? (o.multiple ? [] : ""));
    return Array.isArray(v) ? v : v ? [v] : [];
  };
  const isSel = (val: string): boolean => selected().includes(val);
  const filtered = (): Select2Option[] => {
    const q = query().trim().toLowerCase();
    return q ? opts().filter((x) => x.label.toLowerCase().includes(q)) : opts();
  };
  const labelFor = (val: string): string => opts().find((x) => x.value === val)?.label ?? val;

  const pick = (val: string): void => {
    if (o.multiple) {
      const next = isSel(val) ? selected().filter((v) => v !== val) : [...selected(), val];
      o.onChange?.(next);
    } else {
      o.onChange?.(val);
      open.set(false);
      query.set("");
    }
  };

  const faceText = (): TemplateResult | string => {
    const sel = selected();
    if (sel.length === 0) return html`<span class="dx-s2-ph">${o.placeholder ?? "Select…"}</span>`;
    if (o.multiple)
      return html`<span class="dx-s2-chips">${sel.map(
        (v) => html`<span class="dx-s2-chip">${labelFor(v)}<button class="dx-s2-chipx" aria-label=${`Remove ${labelFor(v)}`} @click=${(e: MouseEvent) => {
          e.stopPropagation();
          pick(v);
        }}>×</button></span>`,
      )}</span>`;
    return labelFor(sel[0]!);
  };

  return html`<div
    class=${cx("dx-s2", sizeClass(o.size), o.multiple && "is-multi")}
    @focusout=${(e: FocusEvent) => {
      const root = e.currentTarget as HTMLElement;
      const next = e.relatedTarget as Node | null;
      if (!next || !root.contains(next)) open.set(false);
    }}
  >
    <button
      class="dx-s2-face"
      type="button"
      aria-haspopup="listbox"
      aria-expanded=${() => (open() ? "true" : "false")}
      aria-label=${o.ariaLabel ?? false}
      @click=${() => open.set(!open())}
    >${() => faceText()}<span class="dx-s2-caret" aria-hidden="true">▾</span></button>
    <div class="dx-s2-pop" role="listbox" ?hidden=${() => !open()}>
      <input
        class="dx-s2-search"
        type="search"
        placeholder=${o.searchPlaceholder ?? "Filter…"}
        aria-label="Filter options"
        .value=${() => query()}
        @input=${(e: Event) => query.set((e.target as HTMLInputElement).value)}
      />
      <div class="dx-s2-list">${list(
        () => filtered(),
        (x) => x.value,
        (opt) =>
          html`<button
            class=${() => cx("dx-s2-opt", isSel(opt.value) && "is-selected")}
            role="option"
            type="button"
            aria-selected=${() => (isSel(opt.value) ? "true" : "false")}
            @click=${() => pick(opt.value)}
          ><span class="dx-s2-check" aria-hidden="true">✓</span>${opt.label}</button>`,
      )}</div>
      ${() => (filtered().length === 0 ? html`<div class="dx-s2-empty">No matches</div>` : "")}
    </div>
  </div>`;
}

// --- Date picker -----------------------------------------------------------
export interface DatePickerOptions {
  /** ISO date (YYYY-MM-DD) or empty. */
  value?: Maybe<string>;
  onChange?: (iso: string) => void;
  placeholder?: string;
  size?: Size;
  /** First day of week: 0=Sun (default), 1=Mon. */
  weekStart?: 0 | 1;
  /** Localised names. Defaults to English. Pass pt-AO names for Portuguese. */
  monthNames?: string[];
  weekdayNames?: string[];
  ariaLabel?: string;
}

const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EN_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const pad2 = (n: number): string => String(n).padStart(2, "0");
const toIso = (y: number, m: number, d: number): string => `${y}-${pad2(m + 1)}-${pad2(d)}`;

/** A calendar date picker. Month grid, prev/next navigation, keyboard-reachable
 *  day buttons. Localise via monthNames/weekdayNames. */
export function datePicker(o: DatePickerOptions): TemplateResult {
  const months = o.monthNames ?? EN_MONTHS;
  const weekdaysBase = o.weekdayNames ?? EN_WEEKDAYS;
  const weekStart = o.weekStart ?? 0;
  const weekdays = weekdaysBase.slice(weekStart).concat(weekdaysBase.slice(0, weekStart));

  const open = signal(false);
  const now = new Date();
  const parse = (): { y: number; m: number; d: number } | null => {
    const v = read(o.value ?? "");
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (!match) return null;
    return { y: +match[1]!, m: +match[2]! - 1, d: +match[3]! };
  };
  const initial = parse();
  const viewY = signal(initial?.y ?? now.getFullYear());
  const viewM = signal(initial?.m ?? now.getMonth());

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
  };

  const grid = (): Array<number | null> => {
    const y = viewY();
    const m = viewM();
    const firstDow = (new Date(y, m, 1).getDay() - weekStart + 7) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    const cells: Array<number | null> = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= days; d++) cells.push(d);
    return cells;
  };

  const isSelected = (d: number): boolean => {
    const p = parse();
    return !!p && p.y === viewY() && p.m === viewM() && p.d === d;
  };
  const isToday = (d: number): boolean =>
    now.getFullYear() === viewY() && now.getMonth() === viewM() && now.getDate() === d;

  const faceLabel = (): string => read(o.value ?? "") || (o.placeholder ?? "Pick a date");

  return html`<div
    class=${cx("dx-dp", sizeClass(o.size))}
    @focusout=${(e: FocusEvent) => {
      const root = e.currentTarget as HTMLElement;
      const next = e.relatedTarget as Node | null;
      if (!next || !root.contains(next)) open.set(false);
    }}
  >
    <button
      class=${() => cx("dx-dp-face", !read(o.value ?? "") && "is-empty")}
      type="button"
      aria-haspopup="dialog"
      aria-expanded=${() => (open() ? "true" : "false")}
      aria-label=${o.ariaLabel ?? false}
      @click=${() => open.set(!open())}
    ><span class="dx-dp-ico" aria-hidden="true">📅</span>${() => faceLabel()}</button>
    <div class="dx-dp-pop" role="dialog" ?hidden=${() => !open()}>
      <div class="dx-dp-head">
        <button class="dx-btn is-icon" type="button" aria-label="Previous month" @click=${() => move(-1)}>‹</button>
        <span class="dx-dp-title">${() => `${months[viewM()]} ${viewY()}`}</span>
        <button class="dx-btn is-icon" type="button" aria-label="Next month" @click=${() => move(1)}>›</button>
      </div>
      <div class="dx-dp-grid dx-dp-dow">${weekdays.map((w) => html`<span class="dx-dp-wd">${w}</span>`)}</div>
      <div class="dx-dp-grid">${() =>
        grid().map((d) =>
          d === null
            ? html`<span class="dx-dp-cell is-empty"></span>`
            : html`<button
                class=${cx("dx-dp-cell", isSelected(d) && "is-selected", isToday(d) && "is-today")}
                type="button"
                aria-pressed=${isSelected(d) ? "true" : "false"}
                @click=${() => {
                  o.onChange?.(toIso(viewY(), viewM(), d));
                  open.set(false);
                }}
              >${d}</button>`,
        )}</div>
    </div>
  </div>`;
}

// --- Timer (countdown / stopwatch) -----------------------------------------
export interface TimerOptions {
  mode?: "countdown" | "stopwatch";
  /** Countdown start (seconds). Default 60. */
  seconds?: number;
  /** Autostart. */
  running?: boolean;
  onComplete?: () => void;
  /** Show start/pause/reset controls. Default true. */
  controls?: boolean;
}

/** A countdown or stopwatch with mm:ss display. Interval is torn down on cleanup
 *  (owner scope), so it stops when the host unmounts. */
export function timer(o: TimerOptions = {}): TemplateResult {
  const total = o.seconds ?? 60;
  const remaining = signal(o.mode === "stopwatch" ? 0 : total);
  const running = signal(false);
  let handle: ReturnType<typeof setInterval> | undefined;

  const stop = (): void => {
    running.set(false);
    if (handle !== undefined) clearInterval(handle);
    handle = undefined;
  };
  const tick = (): void => {
    if (o.mode === "stopwatch") {
      remaining.update((x) => x + 1);
    } else {
      remaining.update((x) => Math.max(0, x - 1));
      if (remaining() <= 0) {
        stop();
        o.onComplete?.();
      }
    }
  };
  const start = (): void => {
    if (running()) return;
    if (o.mode !== "stopwatch" && remaining() <= 0) remaining.set(total);
    running.set(true);
    handle = setInterval(tick, 1000);
  };
  const reset = (): void => {
    stop();
    remaining.set(o.mode === "stopwatch" ? 0 : total);
  };

  if (o.running) start();
  onCleanup(stop);

  const face = (): string => {
    const s = remaining();
    return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
  };

  return html`<div class="dx-timer">
    <span class=${() => cx("dx-timer-face", running() && "is-running", o.mode !== "stopwatch" && remaining() <= 0 && "is-done")} role="timer" aria-live="off">${() => face()}</span>
    ${o.controls === false
      ? ""
      : html`<div class="dx-timer-ctl">
          <button class="dx-btn is-icon" type="button" aria-label="Start" @click=${start}>▶</button>
          <button class="dx-btn is-icon" type="button" aria-label="Pause" @click=${stop}>⏸</button>
          <button class="dx-btn is-icon" type="button" aria-label="Reset" @click=${reset}>↺</button>
        </div>`}
  </div>`;
}
