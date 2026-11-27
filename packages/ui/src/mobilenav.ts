// @dxjs/ui/mobilenav — touch-first navigation surfaces: a fixed bottom tab bar
// and a floating action button with an optional speed-dial. Class-only styling
// (CSP-safe: no inline styles/handlers, no eval), reactive accessors, correct
// ARIA (tablist/tab, menu/menuitem). The speed-dial closes on Escape and on
// focus leaving the root — no document-level listeners to leak.

import { signal, onCleanup } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, type Maybe, type Tone } from "./base.ts";
import { icon, type IconName } from "./icons.ts";

// --- Bottom tab bar --------------------------------------------------------
export interface TabBarItem {
  /** Stable id, reported to `onSelect` and compared against `active`. */
  id: string;
  label: string;
  icon: IconName;
  /** Optional count/dot shown as a bubble over the icon. */
  badge?: Maybe<string | number>;
}
export interface TabBarOptions {
  items: Maybe<TabBarItem[]>;
  /** Id of the selected tab. */
  active: Maybe<string>;
  onSelect?: (id: string) => void;
  ariaLabel?: string;
}

/** A fixed bottom navigation bar: icon-over-label items with large touch
 *  targets, the active one accented, and an optional badge bubble. role=tablist
 *  with role=tab / aria-selected per item. */
export function tabBar(o: TabBarOptions): TemplateResult {
  return html`<nav
    class="dx-tabbar"
    role="tablist"
    aria-label=${o.ariaLabel ?? false}
  >${list(
    () => read(o.items),
    (it) => it.id,
    (it) => {
      const selected = (): boolean => read(o.active) === it.id;
      return html`<button
        class=${() => cx("dx-tabbar-item", selected() && "is-active")}
        type="button"
        role="tab"
        aria-selected=${() => (selected() ? "true" : "false")}
        @click=${() => o.onSelect?.(it.id)}
      ><span class="dx-tabbar-ico" aria-hidden="true">${icon(it.icon)}${
        it.badge != null
          ? html`<span class="dx-tabbar-badge">${() => read(it.badge!)}</span>`
          : ""
      }</span><span class="dx-tabbar-label">${it.label}</span></button>`;
    },
  )}</nav>`;
}

// --- Floating action button ------------------------------------------------
export interface FabAction {
  label: string;
  icon: IconName;
  onClick?: () => void;
}
export interface FabOptions {
  /** Glyph for the main button (default "plus"). */
  icon?: IconName;
  /** Accessible name for the main button (required — it is icon-only). */
  label: string;
  onClick?: () => void;
  /** Screen corner it floats in (default "br" — bottom-right). */
  position?: "br" | "bl";
  tone?: Tone;
  /** When given, the main button toggles a vertical speed-dial of these. */
  actions?: FabAction[];
}

/** A floating action button. With no `actions` it is a plain button that calls
 *  `onClick`. With `actions`, clicking toggles a small vertical speed-dial of
 *  labelled mini buttons (role=menu / menuitem); the dial closes on select,
 *  Escape, or focus leaving the root. */
export function fab(o: FabOptions): TemplateResult {
  const open = signal(false);
  const actions = o.actions ?? [];
  const hasActions = actions.length > 0;

  const close = (): void => {
    open.set(false);
  };
  onCleanup(close);

  const onTrigger = (): void => {
    if (hasActions) open.set(!open());
    else o.onClick?.();
  };
  const choose = (a: FabAction): void => {
    a.onClick?.();
    close();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") close();
  };

  const actionView = (a: FabAction): TemplateResult =>
    html`<button
      class="dx-fab-action"
      type="button"
      role="menuitem"
      aria-label=${a.label}
      @click=${() => choose(a)}
    ><span class="dx-fab-action-label" aria-hidden="true">${a.label}</span><span class="dx-fab-action-ico" aria-hidden="true">${icon(a.icon, { size: 18 })}</span></button>`;

  return html`<div
    class=${cx("dx-fab-root", `is-${o.position ?? "br"}`)}
    @keydown=${onKey}
    @focusout=${(e: FocusEvent) => {
      const root = e.currentTarget as HTMLElement;
      const next = e.relatedTarget as Node | null;
      if (!next || !root.contains(next)) close();
    }}
  >${hasActions
    ? html`<div class="dx-fab-dial" role="menu" aria-label=${o.label} ?hidden=${() => !open()}>${actions.map(actionView)}</div>`
    : ""}<button
      class=${() => cx("dx-fab", o.tone && `is-${o.tone}`, hasActions && open() && "is-open")}
      type="button"
      aria-label=${o.label}
      aria-haspopup=${hasActions ? "menu" : false}
      aria-expanded=${hasActions ? () => (open() ? "true" : "false") : false}
      @click=${onTrigger}
    >${() => icon(o.icon ?? "plus", { size: 24 })}</button></div>`;
}
