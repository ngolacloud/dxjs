// @dxjs/ui/feedback — alert, modal/dialog, tooltip, skeleton, spinner, progress,
// meter and empty-state. All class-only and CSP-safe. Progress uses the native
// <progress> element and the meter uses an SVG width-by-ATTRIBUTE (never an inline
// `style=`), so widths stay out of `style-src`.

import { html, type TemplateResult } from "@dxjs/dom";
import { read, nextId, cx, type Maybe, type Tone } from "./base.ts";
import { button } from "./controls.ts";

// --- Alert -----------------------------------------------------------------
export interface AlertOptions {
  tone?: Tone;
  title?: string;
  body?: Maybe<TemplateResult | string>;
  /** Show a dismiss button; called when clicked. */
  onDismiss?: () => void;
  /** Leading icon/glyph. */
  icon?: TemplateResult | string;
}

/** A banner for inline status/explanation. tone → colour. */
export function alert(o: AlertOptions): TemplateResult {
  return html`<div class=${`dx-alert is-${o.tone ?? "info"}`} role=${o.tone === "neg" ? "alert" : "status"}>
    ${o.icon ? html`<span class="dx-alert-ico" aria-hidden="true">${o.icon}</span>` : ""}
    <div class="dx-alert-body">
      ${o.title ? html`<div class="dx-alert-title">${o.title}</div>` : ""}
      ${o.body ? html`<div class="dx-alert-text">${() => read(o.body!)}</div>` : ""}
    </div>
    ${o.onDismiss ? html`<button class="dx-alert-x" aria-label="Dismiss" @click=${() => o.onDismiss!()}>×</button>` : ""}
  </div>`;
}

// --- Modal / dialog --------------------------------------------------------
export interface ModalOptions {
  open: Maybe<boolean>;
  title?: string;
  body: Maybe<TemplateResult | string>;
  /** Footer actions (e.g. a row of buttons). */
  footer?: Maybe<TemplateResult>;
  onClose?: () => void;
  /** Max width in px (default 480). */
  width?: number;
  size?: "sm" | "md" | "lg";
}

/** A centred modal over a backdrop. Hidden when `open` is false; Esc + backdrop
 *  click call onClose. aria-modal dialog with a labelled title. */
export function modal(o: ModalOptions): TemplateResult {
  const titleId = o.title ? nextId("dx-modal") : "";
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") o.onClose?.();
  };
  return html`<div
    class=${cx("dx-modal-backdrop", o.size && `is-${o.size}`)}
    ?hidden=${() => !read(o.open)}
    @click=${(e: MouseEvent) => {
      if (e.target === e.currentTarget) o.onClose?.();
    }}
    @keydown=${onKey}
  >
    <div class="dx-modal" role="dialog" aria-modal="true" aria-labelledby=${titleId || false}>
      ${o.title ? html`<div class="dx-modal-head"><h2 class="dx-modal-title" id=${titleId}>${o.title}</h2><button class="dx-modal-x" aria-label="Close" @click=${() => o.onClose?.()}>×</button></div>` : ""}
      <div class="dx-modal-body">${() => read(o.body)}</div>
      ${o.footer ? html`<div class="dx-modal-foot">${() => read(o.footer!)}</div>` : ""}
    </div>
  </div>`;
}

// --- Tooltip ---------------------------------------------------------------
export interface TooltipOptions {
  tip: string;
  /** The element the tooltip describes. */
  children: TemplateResult | string;
  placement?: "top" | "bottom" | "left" | "right";
}

/** A hover/focus tooltip. The tip is a sibling element revealed by CSS — no JS
 *  positioning, no inline styles. */
export function tooltip(o: TooltipOptions): TemplateResult {
  const id = nextId("dx-tip");
  return html`<span class=${cx("dx-tip-wrap", `is-${o.placement ?? "top"}`)} tabindex="0" aria-describedby=${id}>
    ${o.children}<span class="dx-tip" role="tooltip" id=${id}>${o.tip}</span>
  </span>`;
}

// --- Skeleton --------------------------------------------------------------
export interface SkeletonOptions {
  /** line (text), rect (block), circle (avatar). */
  kind?: "line" | "rect" | "circle";
  /** Number of lines (for kind=line). */
  lines?: number;
}
export function skeleton(o: SkeletonOptions = {}): TemplateResult {
  const kind = o.kind ?? "line";
  if (kind === "line") {
    const n = o.lines ?? 3;
    return html`<div class="dx-skel-lines" aria-hidden="true">${Array.from(
      { length: n },
      () => html`<span class="dx-skel dx-skel-line"></span>`,
    )}</div>`;
  }
  return html`<span class=${`dx-skel dx-skel-${kind}`} aria-hidden="true"></span>`;
}

// --- Spinner ---------------------------------------------------------------
export function spinner(label = "Loading"): TemplateResult {
  return html`<span class="dx-spinner" role="status" aria-label=${label}></span>`;
}

// --- Progress (determinate) ------------------------------------------------
export interface ProgressOptions {
  value: Maybe<number>;
  max?: number;
  /** Show the numeric percentage after the bar. */
  showValue?: boolean;
  tone?: Tone;
}

/** A determinate progress bar built on the native <progress> element. */
export function progress(o: ProgressOptions): TemplateResult {
  const max = o.max ?? 100;
  return html`<div class="dx-progress-row">
    <progress class=${cx("dx-progress", o.tone && `is-${o.tone}`)} max=${max} value=${() => read(o.value)}></progress>
    ${o.showValue ? html`<span class="dx-progress-val">${() => Math.round((read(o.value) / max) * 100)}%</span>` : ""}
  </div>`;
}

// --- Meter (thin inline bar; width by SVG attribute → CSP-safe) ------------
export interface MeterOptions {
  /** 0..1 fraction. */
  value: Maybe<number>;
  tone?: Tone;
  label?: string;
}

/** A thin usage meter (e.g. CPU/memory). The fill width is an SVG rect width
 *  ATTRIBUTE, not an inline style, so it is not blocked by `style-src`. */
export function meter(o: MeterOptions): TemplateResult {
  const pct = (): number => Math.max(0, Math.min(1, read(o.value))) * 100;
  return html`<div class=${cx("dx-meter", o.tone && `is-${o.tone}`)} role="progressbar" aria-label=${o.label ?? false}>
    <svg class="dx-meter-svg" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
      <rect class="dx-meter-bg" x="0" y="0" width="100" height="6" rx="3"></rect>
      <rect class="dx-meter-fill" x="0" y="0" width=${() => pct()} height="6" rx="3"></rect>
    </svg>
  </div>`;
}

// --- Empty state -----------------------------------------------------------
export interface EmptyStateOptions {
  title: string;
  description?: string;
  icon?: TemplateResult | string;
  action?: { label: string; onClick: () => void };
}
export function emptyState(o: EmptyStateOptions): TemplateResult {
  return html`<div class="dx-empty">
    ${o.icon ? html`<div class="dx-empty-ico" aria-hidden="true">${o.icon}</div>` : ""}
    <div class="dx-empty-title">${o.title}</div>
    ${o.description ? html`<p class="dx-empty-desc">${o.description}</p>` : ""}
    ${o.action ? button({ label: o.action.label, variant: "primary", onClick: o.action.onClick }) : ""}
  </div>`;
}
