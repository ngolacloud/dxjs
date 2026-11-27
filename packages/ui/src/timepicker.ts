// @dxjs/ui/timepicker — a time-of-day picker. A face button shows the formatted
// time (or a placeholder) and opens a listbox popover of selectable slots from
// 00:00 to 23:59 at a given step. Class-only + CSP-safe: no inline styles/handlers
// and no eval. The popover closes on Escape and on focus leaving the root
// (focusout) — no document-level listeners to leak. The committed value is always
// a 24h "HH:MM" string even when the face displays am/pm.

import { signal } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, nextId, cx, sizeClass, type Maybe, type Size } from "./base.ts";
import { icon } from "./icons.ts";

/** Build the selectable "HH:MM" slots from 00:00 up to 23:59 at `step` minutes.
 *  Pure and deterministic, so it is unit-testable on its own. `step` is clamped
 *  to a minimum of 1 minute. */
export function buildSlots(step: number): string[] {
  const s = Math.max(1, Math.floor(step));
  const out: string[] = [];
  for (let m = 0; m < 24 * 60; m += s) {
    const hh = Math.floor(m / 60);
    const mm = m % 60;
    out.push(`${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`);
  }
  return out;
}

/** Format a 24h "HH:MM" for display. With `hour12`, render 12-hour am/pm; the
 *  stored value stays 24h regardless. */
function formatTime(hhmm: string, hour12: boolean): string {
  const [h, m] = hhmm.split(":");
  if (!hour12) return `${h}:${m}`;
  const hour = Number(h);
  const period = hour < 12 ? "AM" : "PM";
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${m} ${period}`;
}

export interface TimePickerOptions {
  /** The selected time as 24h "HH:MM" (static or reactive). */
  value?: Maybe<string>;
  /** Called with the chosen 24h "HH:MM" when an option is picked. */
  onChange?: (value: string) => void;
  /** Slot granularity in minutes (default 15). */
  step?: number;
  /** Display 12-hour am/pm on the face and options (value stays 24h). */
  hour12?: boolean;
  disabled?: Maybe<boolean>;
  size?: Size;
  /** Face text when no value is set. */
  placeholder?: string;
  ariaLabel?: string;
}

/** A time-of-day picker. The face button shows the formatted time (or the
 *  placeholder) and toggles a `role="listbox"` popover of `role="option"` slots.
 *  Arrow keys move the active option, Enter/Space commits it, Escape and focus
 *  leaving the root close the popover. Picking an option calls `onChange("HH:MM")`
 *  and closes. */
export function timePicker(o: TimePickerOptions): TemplateResult {
  const open = signal(false);
  const active = signal(-1);
  const slots = buildSlots(o.step ?? 15);
  const listId = nextId("dx-tmp");
  const hour12 = o.hour12 ?? false;

  const current = (): string => read(o.value ?? "");
  const selectedIndex = (): number => slots.indexOf(current());
  const faceText = (): string => {
    const v = current();
    return v ? formatTime(v, hour12) : (o.placeholder ?? "Select time");
  };

  const close = (): void => {
    open.set(false);
    active.set(-1);
  };
  const openList = (): void => {
    open.set(true);
    const si = selectedIndex();
    active.set(si >= 0 ? si : 0);
  };
  const choose = (slot: string): void => {
    o.onChange?.(slot);
    close();
  };
  const step = (delta: number): void => {
    if (slots.length === 0) return;
    const curr = active();
    const next = curr < 0 ? (delta > 0 ? 0 : slots.length - 1) : (curr + delta + slots.length) % slots.length;
    active.set(next);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open()) openList();
      else step(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open()) openList();
      else step(-1);
    } else if ((e.key === "Enter" || e.key === " ") && open() && active() >= 0) {
      e.preventDefault();
      const slot = slots[active()];
      if (slot) choose(slot);
    }
  };

  const optView = (slot: string, i: number): TemplateResult =>
    html`<button
      class=${() => cx("dx-tmp-opt", active() === i && "is-active", current() === slot && "is-selected")}
      type="button"
      role="option"
      aria-selected=${() => (current() === slot ? "true" : "false")}
      @click=${() => choose(slot)}
      @mouseenter=${() => active.set(i)}
    >${() => formatTime(slot, hour12)}</button>`;

  return html`<div
    class=${cx("dx-tmp", sizeClass(o.size))}
    @keydown=${onKey}
    @focusout=${(e: FocusEvent) => {
      const root = e.currentTarget as HTMLElement;
      const next = e.relatedTarget as Node | null;
      if (!next || !root.contains(next)) close();
    }}
  >
    <button
      class="dx-tmp-face"
      type="button"
      aria-haspopup="listbox"
      aria-expanded=${() => (open() ? "true" : "false")}
      aria-controls=${listId}
      aria-label=${o.ariaLabel ?? false}
      ?disabled=${() => read(o.disabled ?? false)}
      @click=${() => (open() ? close() : openList())}
    ><span class="dx-tmp-ico" aria-hidden="true">${icon("clock", { size: 16 })}</span><span
      class=${() => cx("dx-tmp-val", !current() && "is-placeholder")}
    >${() => faceText()}</span><span class="dx-tmp-caret" aria-hidden="true">▾</span></button>
    <div
      class="dx-tmp-pop"
      id=${listId}
      role="listbox"
      aria-label=${o.ariaLabel ?? "Time"}
      ?hidden=${() => !open()}
    >${list(() => slots, (slot) => slot, optView)}</div>
  </div>`;
}
