// @dxjs/ui/nav — navigation & structure: tabs, segmented control, breadcrumb,
// an icon navigation panel, avatar and divider. Class-only, reactive, CSP-safe.

import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, nextId, cx, type Maybe } from "./base.ts";

// --- Tabs (underline) ------------------------------------------------------
export interface TabItem {
  id: string;
  label: string;
  /** Optional count badge. */
  count?: Maybe<number>;
  disabled?: boolean;
}
export interface TabsOptions {
  tabs: Maybe<TabItem[]>;
  active: Maybe<string>;
  onSelect?: (id: string) => void;
  ariaLabel?: string;
}

/** An underline tab bar (role=tablist). The active tab reads reactively. */
export function tabs(o: TabsOptions): TemplateResult {
  const tab = (t: TabItem): TemplateResult =>
    html`<button
      class=${() => cx("dx-tab", read(o.active) === t.id && "is-active")}
      role="tab"
      type="button"
      aria-selected=${() => (read(o.active) === t.id ? "true" : "false")}
      ?disabled=${t.disabled ?? false}
      @click=${() => o.onSelect?.(t.id)}
    >${t.label}${t.count !== undefined ? html`<span class="dx-tab-count">${() => read(t.count!)}</span>` : ""}</button>`;
  return html`<div class="dx-tabs" role="tablist" aria-label=${o.ariaLabel ?? false}>${list(
    () => read(o.tabs),
    (t) => t.id,
    tab,
  )}</div>`;
}

// --- Segmented control -----------------------------------------------------
export interface SegmentedOptions {
  options: Maybe<{ value: string; label: string }[]>;
  value: Maybe<string>;
  onChange?: (value: string) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}

/** A pill-group single-select (iOS-style). */
export function segmented(o: SegmentedOptions): TemplateResult {
  return html`<div class=${cx("dx-seg", o.size === "md" && "is-md")} role="tablist" aria-label=${o.ariaLabel ?? false}>${list(
    () => read(o.options),
    (x) => x.value,
    (opt) =>
      html`<button
        class=${() => cx("dx-seg-item", read(o.value) === opt.value && "is-active")}
        role="tab"
        type="button"
        aria-selected=${() => (read(o.value) === opt.value ? "true" : "false")}
        @click=${() => o.onChange?.(opt.value)}
      >${opt.label}</button>`,
  )}</div>`;
}

// --- Breadcrumb ------------------------------------------------------------
export interface Crumb {
  label: string;
  onClick?: () => void;
}
export function breadcrumb(items: Crumb[]): TemplateResult {
  const last = items.length - 1;
  return html`<nav class="dx-crumbs" aria-label="Breadcrumb"><ol>${items.map(
    (c, i) =>
      html`<li>${
        i === last || !c.onClick
          ? html`<span class="dx-crumb is-current" aria-current=${i === last ? "page" : false}>${c.label}</span>`
          : html`<button class="dx-crumb dx-link-btn" @click=${() => c.onClick!()}>${c.label}</button>`
      }${i < last ? html`<span class="dx-crumb-sep" aria-hidden="true">/</span>` : ""}</li>`,
  )}</ol></nav>`;
}

// --- Icon navigation panel -------------------------------------------------
export interface PanelItem {
  id: string;
  label: string;
  /** An icon template (e.g. an inline <svg>) or short glyph. */
  icon?: TemplateResult | string;
  badge?: Maybe<string | number>;
}
export interface PanelGroup {
  label?: string;
  items: PanelItem[];
}
export interface NavPanelOptions {
  groups: Maybe<PanelGroup[]>;
  active: Maybe<string>;
  onSelect?: (id: string) => void;
  ariaLabel?: string;
}

/** A grouped navigation panel with icons + labels + optional badges. Reusable on
 *  its own (the appShell has its own simpler nav). */
export function navPanel(o: NavPanelOptions): TemplateResult {
  const item = (it: PanelItem): TemplateResult =>
    html`<button
      class=${() => cx("dx-pnav-item", read(o.active) === it.id && "is-active")}
      type="button"
      aria-current=${() => (read(o.active) === it.id ? "page" : false)}
      @click=${() => o.onSelect?.(it.id)}
    >
      ${it.icon ? html`<span class="dx-pnav-ico" aria-hidden="true">${it.icon}</span>` : html`<span class="dx-dot" aria-hidden="true"></span>`}
      <span class="dx-pnav-label">${it.label}</span>
      ${it.badge !== undefined ? html`<span class="dx-pnav-badge">${() => read(it.badge!)}</span>` : ""}
    </button>`;
  const group = (g: PanelGroup): TemplateResult =>
    html`<div class="dx-pnav-group">${g.label ? html`<div class="dx-pnav-grouplabel">${g.label}</div>` : ""}${g.items.map(item)}</div>`;
  return html`<nav class="dx-pnav" aria-label=${o.ariaLabel ?? "Navigation"}>${() => read(o.groups).map(group)}</nav>`;
}

// --- Avatar ----------------------------------------------------------------
export interface AvatarOptions {
  initials?: string;
  /** Same-origin image URL (CSP img-src 'self'). */
  src?: string;
  name?: string;
  size?: "sm" | "md" | "lg";
}
export function avatar(o: AvatarOptions): TemplateResult {
  const cls = cx("dx-avatar2", o.size && o.size !== "md" && `is-${o.size}`);
  if (o.src) return html`<img class=${cls} src=${o.src} alt=${o.name ?? ""} />`;
  return html`<span class=${cls} role="img" aria-label=${o.name ?? false}>${o.initials ?? "?"}</span>`;
}

// --- Divider ---------------------------------------------------------------
export function divider(label?: string): TemplateResult {
  if (label) return html`<div class="dx-divider has-label" role="separator"><span>${label}</span></div>`;
  return html`<hr class="dx-divider" />`;
}
