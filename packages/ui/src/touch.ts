// @dxjs/ui/touch — touch-first interaction primitives: swipe-to-reveal row
// actions, pull-to-refresh, and a vertical picker wheel. Class-only styling and
// CSP-safe: dynamic offsets are pushed through CSS custom properties via the
// CSSOM (`element.style.setProperty`) — never an inline `style=` attribute — and
// pointer gestures use pointer events with capture, torn down on owner cleanup.
//
// Every gesture has an equivalent pointer/keyboard affordance (real buttons, a
// focusable listbox with arrow keys) so the components stay operable without a
// touchscreen and remain testable without synthesising raw touches.

import { signal, effect, onCleanup } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, nextId, cx, type Maybe, type Tone } from "./base.ts";
import { icon, type IconName } from "./icons.ts";

// --- Swipe actions ---------------------------------------------------------
export interface SwipeAction {
  label: string;
  icon?: IconName;
  tone?: Tone;
  onSelect: () => void;
}
export interface SwipeActionsOptions {
  children: TemplateResult | string;
  /** Trailing actions revealed by dragging the row left. */
  actions: SwipeAction[];
  ariaLabel?: string;
}

/** A list row that reveals trailing action buttons when dragged left. The drag
 *  is tracked with pointer events + capture and exposed through the `--dx-swipe`
 *  custom property on the sliding surface; on release it snaps open or closed.
 *  The actions are always real buttons, so the row is fully operable by pointer
 *  and keyboard — clicking an action fires its `onSelect` and snaps shut. */
export function swipeActions(o: SwipeActionsOptions): TemplateResult {
  const open = signal(false);
  let surfaceEl: HTMLElement | null = null;
  let actionsEl: HTMLElement | null = null;
  let dragging = false;
  let startX = 0;
  let base = 0;

  const width = (): number =>
    actionsEl ? actionsEl.getBoundingClientRect().width || actionsEl.offsetWidth || 0 : 0;
  const setOffset = (px: number): void => surfaceEl?.style.setProperty("--dx-swipe", `${px}px`);
  const clamp = (px: number, w: number): number => Math.min(0, Math.max(-w, px));

  const snap = (openIt: boolean): void => {
    open.set(openIt);
    setOffset(openIt ? -width() : 0);
  };
  const choose = (a: SwipeAction): void => {
    a.onSelect();
    snap(false);
  };

  const onDown = (e: PointerEvent): void => {
    if (e.button != null && e.button > 0) return;
    dragging = true;
    startX = e.clientX;
    base = open() ? -width() : 0;
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    setOffset(clamp(base + (e.clientX - startX), width()));
  };
  const onUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
    const w = width();
    const dx = clamp(base + (e.clientX - startX), w);
    snap(w > 0 && -dx > w / 2);
  };

  return html`<div
    class=${() => cx("dx-swipe", open() && "is-open")}
    role="group"
    aria-label=${o.ariaLabel ?? false}
  >
    <div class="dx-swipe-actions" ref=${(el: Element) => (actionsEl = el as HTMLElement)}>
      ${o.actions.map(
        (a) => html`<button
          class=${cx("dx-swipe-action", a.tone && `is-${a.tone}`)}
          type="button"
          @click=${() => choose(a)}
        >${a.icon ? html`<span class="dx-swipe-ico" aria-hidden="true">${icon(a.icon)}</span>` : ""}<span class="dx-swipe-label">${a.label}</span></button>`,
      )}
    </div>
    <div
      class="dx-swipe-surface"
      ref=${(el: Element) => (surfaceEl = el as HTMLElement)}
      @pointerdown=${onDown}
      @pointermove=${onMove}
      @pointerup=${onUp}
      @pointercancel=${onUp}
    >${o.children}</div>
  </div>`;
}

// --- Pull to refresh -------------------------------------------------------
export interface PullToRefreshOptions {
  children: Maybe<TemplateResult | string>;
  onRefresh: () => void | Promise<void>;
  /** Externally controlled busy state, OR-ed with the internal one. */
  refreshing?: Maybe<boolean>;
  label?: string;
  ariaLabel?: string;
}

/** Distance past which a downward pull commits a refresh (px). */
export const PULL_THRESHOLD = 72;

/** A container that refreshes when dragged down from the top. The pull distance
 *  (rubber-banded) drives the `--dx-pull` custom property on the root; crossing
 *  `PULL_THRESHOLD` on release calls `onRefresh`. A real refresh button in the
 *  indicator gives keyboard/pointer users the same action and makes the busy
 *  state observable (aria-busy / disabled). */
export function pullToRefresh(o: PullToRefreshOptions): TemplateResult {
  const busy = signal(false);
  const isBusy = (): boolean => read(o.refreshing ?? false) || busy();
  let rootEl: HTMLElement | null = null;
  let contentEl: HTMLElement | null = null;
  let dragging = false;
  let startY = 0;

  const setPull = (px: number): void => rootEl?.style.setProperty("--dx-pull", `${px}px`);

  const trigger = async (): Promise<void> => {
    if (isBusy()) return;
    busy.set(true);
    try {
      await o.onRefresh();
    } finally {
      busy.set(false);
      setPull(0);
    }
  };

  const onDown = (e: PointerEvent): void => {
    if (!contentEl || contentEl.scrollTop > 0 || isBusy()) return;
    dragging = true;
    startY = e.clientY;
    contentEl.setPointerCapture?.(e.pointerId);
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const dy = e.clientY - startY;
    setPull(dy <= 0 ? 0 : Math.min(dy * 0.5, 120));
  };
  const onUp = (e: PointerEvent): void => {
    if (!dragging) return;
    dragging = false;
    contentEl?.releasePointerCapture?.(e.pointerId);
    const dy = e.clientY - startY;
    if (dy > PULL_THRESHOLD) void trigger();
    else setPull(0);
  };

  return html`<div
    class=${() => cx("dx-ptr", isBusy() && "is-busy")}
    ref=${(el: Element) => (rootEl = el as HTMLElement)}
    role="region"
    aria-label=${o.ariaLabel ?? o.label ?? false}
    aria-busy=${() => (isBusy() ? "true" : false)}
  >
    <div class="dx-ptr-indicator" role="status" aria-live="polite">
      <button
        class="dx-ptr-btn"
        type="button"
        aria-label=${o.label ?? "Refresh"}
        ?disabled=${() => isBusy()}
        @click=${() => void trigger()}
      ><span class="dx-ptr-spin" aria-hidden="true">${icon("refresh")}</span><span class="dx-ptr-label">${() => (isBusy() ? "Refreshing…" : (o.label ?? "Pull to refresh"))}</span></button>
    </div>
    <div
      class="dx-ptr-content"
      ref=${(el: Element) => (contentEl = el as HTMLElement)}
      @pointerdown=${onDown}
      @pointermove=${onMove}
      @pointerup=${onUp}
      @pointercancel=${onUp}
    >${() => read(o.children)}</div>
  </div>`;
}

// --- Picker wheel ----------------------------------------------------------
export interface WheelOption {
  value: string;
  label: string;
}
export interface PickerWheelOptions {
  options: Maybe<WheelOption[]>;
  value: Maybe<string>;
  onChange?: (value: string) => void;
  ariaLabel?: string;
  /** Rows visible in the wheel window (odd looks best; default 5). */
  visibleCount?: number;
}

/** The index of `value` within `options`, clamped to a valid row (0 if absent).
 *  Pure, so the centring math is unit-testable without a DOM. */
export function wheelIndexOf(options: WheelOption[], value: string): number {
  const i = options.findIndex((op) => op.value === value);
  return i < 0 ? 0 : i;
}

/** A vertical wheel selector. The chosen row is centred and highlighted; the
 *  track is offset via the `--dx-wheel-i` custom property (the row index — the
 *  pixel math lives in CSS). It is a focusable `listbox`: Up/Down (and Home/End)
 *  move the selection and clicking a row selects it, so it needs no touchscreen. */
export function pickerWheel(o: PickerWheelOptions): TemplateResult {
  const base = nextId("dx-wheel");
  let trackEl: HTMLElement | null = null;

  const opts = (): WheelOption[] => read(o.options);
  const selIndex = (): number => wheelIndexOf(opts(), read(o.value ?? ""));
  const pushOffset = (i: number): void => trackEl?.style.setProperty("--dx-wheel-i", String(i));

  const select = (i: number): void => {
    const list = opts();
    if (i < 0 || i >= list.length) return;
    pushOffset(i);
    o.onChange?.(list[i]!.value);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      select(selIndex() + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      select(selIndex() - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      select(0);
    } else if (e.key === "End") {
      e.preventDefault();
      select(opts().length - 1);
    }
  };

  return html`<div
    class="dx-wheel"
    role="listbox"
    tabindex="0"
    ref=${(el: Element) => (el as HTMLElement).style.setProperty("--dx-wheel-visible", String(o.visibleCount ?? 5))}
    aria-label=${o.ariaLabel ?? false}
    aria-activedescendant=${() => `${base}-${selIndex()}`}
    @keydown=${onKey}
  >
    <div class="dx-wheel-viewport">
      <div class="dx-wheel-selection" aria-hidden="true"></div>
      <div
        class="dx-wheel-track"
        ref=${(el: Element) => {
          trackEl = el as HTMLElement;
          onCleanup(effect(() => pushOffset(selIndex())));
        }}
      >${list(
        () => opts(),
        (op) => op.value,
        (op, i) => html`<div
          class=${() => cx("dx-wheel-opt", selIndex() === i && "is-selected")}
          id=${`${base}-${i}`}
          role="option"
          aria-selected=${() => (selIndex() === i ? "true" : "false")}
          @click=${() => select(i)}
        >${op.label}</div>`,
      )}</div>
      <div class="dx-wheel-fade dx-wheel-fade-top" aria-hidden="true"></div>
      <div class="dx-wheel-fade dx-wheel-fade-bottom" aria-hidden="true"></div>
    </div>
  </div>`;
}
