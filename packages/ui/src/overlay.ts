// @dxjs/ui/overlay — floating surfaces: a toast notifier, a slide-in drawer and
// a menu dropdown. Class-only, reactive, CSP-safe (no inline styles/handlers, no
// eval). Popovers close on focus leaving the root (focusout) and on Escape — no
// document-level listeners to leak. Timers are torn down on owner cleanup.

import { signal, onCleanup } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, nextId, cx, type Maybe, type Tone } from "./base.ts";

// --- Toaster ---------------------------------------------------------------
export interface Toast {
  /** Stable id (auto-assigned if omitted). */
  id?: string;
  tone?: Tone;
  title?: string;
  message: string;
  /** Auto-dismiss after N ms (default 4000). `0` keeps it until dismissed. */
  duration?: number;
  /** Show a dismiss button (default true). */
  dismissible?: boolean;
}

export interface Toaster {
  /** The toast stack, rendered once near the app root. */
  host: (o?: { placement?: "top" | "bottom"; align?: "start" | "center" | "end" }) => TemplateResult;
  /** Enqueue a toast; returns its id. */
  push: (toast: Toast) => string;
  /** Remove a toast early. */
  dismiss: (id: string) => void;
  /** Remove every toast. */
  clear: () => void;
}

/** Create a toast notifier. Render `host()` once; call `push()` from anywhere.
 *  Each toast auto-dismisses after `duration` ms; the timer is cleared when it
 *  fires and on manual dismiss. If `host()` is rendered inside a reactive owner,
 *  teardown also runs `clear()`; a top-level singleton can call `clear()` itself. */
export function createToaster(): Toaster {
  const items = signal<Toast[]>([]);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const clearTimer = (id: string): void => {
    const h = timers.get(id);
    if (h !== undefined) {
      clearTimeout(h);
      timers.delete(id);
    }
  };

  const dismiss = (id: string): void => {
    clearTimer(id);
    items.set(items().filter((t) => t.id !== id));
  };

  const push = (toast: Toast): string => {
    const id = toast.id ?? nextId("dx-toast");
    const entry: Toast = { dismissible: true, ...toast, id };
    items.set([...items(), entry]);
    const duration = toast.duration ?? 4000;
    if (duration > 0) timers.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  };

  const clear = (): void => {
    for (const id of timers.keys()) clearTimeout(timers.get(id)!);
    timers.clear();
    items.set([]);
  };

  const toastView = (t: Toast): TemplateResult =>
    html`<div class=${cx("dx-toast", `is-${t.tone ?? "info"}`)} role=${t.tone === "neg" ? "alert" : "status"}>
      <div class="dx-toast-body">
        ${t.title ? html`<div class="dx-toast-title">${t.title}</div>` : ""}
        <div class="dx-toast-msg">${t.message}</div>
      </div>
      ${t.dismissible !== false
        ? html`<button class="dx-toast-x" type="button" aria-label="Dismiss" @click=${() => dismiss(t.id!)}>×</button>`
        : ""}
    </div>`;

  const host: Toaster["host"] = (o = {}) => {
    onCleanup(clear);
    return html`<div
      class=${cx("dx-toaster", `is-${o.placement ?? "top"}`, `is-${o.align ?? "end"}`)}
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >${list(() => items(), (t) => t.id!, toastView)}</div>`;
  };

  return { host, push, dismiss, clear };
}

// --- Drawer ----------------------------------------------------------------
export interface DrawerOptions {
  open: Maybe<boolean>;
  onClose?: () => void;
  /** Edge the panel slides from (default "right"). */
  side?: "left" | "right" | "top" | "bottom";
  title?: string;
  body: Maybe<TemplateResult | string>;
  footer?: Maybe<TemplateResult>;
  /** Panel size tier (default "md"). */
  size?: "sm" | "md" | "lg";
}

/** A slide-in panel over a backdrop. Hidden when `open` is false; Esc and a
 *  backdrop click call `onClose`. The `side` and `size` are classes — no inline
 *  styles, so it runs under `style-src 'self'`. */
export function drawer(o: DrawerOptions): TemplateResult {
  const titleId = o.title ? nextId("dx-drawer") : "";
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") o.onClose?.();
  };
  return html`<div
    class=${() => cx("dx-drawer-root", `is-${o.side ?? "right"}`, read(o.open) && "is-open")}
    ?hidden=${() => !read(o.open)}
    @keydown=${onKey}
  >
    <div class="dx-drawer-backdrop" @click=${() => o.onClose?.()}></div>
    <aside
      class=${cx("dx-drawer", `is-${o.size ?? "md"}`)}
      role="dialog"
      aria-modal="true"
      aria-labelledby=${titleId || false}
    >
      ${o.title
        ? html`<header class="dx-drawer-head"><h2 class="dx-drawer-title" id=${titleId}>${o.title}</h2><button class="dx-drawer-x" type="button" aria-label="Close" @click=${() => o.onClose?.()}>×</button></header>`
        : ""}
      <div class="dx-drawer-body">${() => read(o.body)}</div>
      ${o.footer ? html`<footer class="dx-drawer-foot">${() => read(o.footer!)}</footer>` : ""}
    </aside>
  </div>`;
}

// --- Dropdown menu ---------------------------------------------------------
export interface MenuItem {
  label: string;
  onSelect?: () => void;
  icon?: TemplateResult | string;
  disabled?: boolean;
  /** Render a dividing rule *before* this item. */
  separator?: boolean;
  /** Style as a destructive action. */
  danger?: boolean;
}
export interface DropdownOptions {
  label: Maybe<string | TemplateResult>;
  items: Maybe<MenuItem[]>;
  /** Align the popover to the trigger's start (default) or end edge. */
  align?: "start" | "end";
  ariaLabel?: string;
}

/** A button that opens a menu of actions. Opens on click, closes on select,
 *  Escape, or focus leaving the root. Arrow keys move the active item; Enter or
 *  Space fires it. role=menu / menuitem throughout. */
export function dropdown(o: DropdownOptions): TemplateResult {
  const open = signal(false);
  const active = signal(-1);
  const menuId = nextId("dx-menu");
  const enabled = (): MenuItem[] => read(o.items).filter((it) => !it.disabled);

  const close = (): void => {
    open.set(false);
    active.set(-1);
  };
  const choose = (it: MenuItem): void => {
    if (it.disabled) return;
    it.onSelect?.();
    close();
  };
  const step = (delta: number): void => {
    const list = enabled();
    if (list.length === 0) return;
    const curr = active();
    const next = curr < 0 ? (delta > 0 ? 0 : list.length - 1) : (curr + delta + list.length) % list.length;
    active.set(next);
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open()) open.set(true);
      step(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open()) open.set(true);
      step(-1);
    } else if ((e.key === "Enter" || e.key === " ") && open() && active() >= 0) {
      e.preventDefault();
      const it = enabled()[active()];
      if (it) choose(it);
    }
  };

  const itemView = (it: MenuItem, i: number): TemplateResult => {
    // The active index is over the ENABLED items; map it to this row.
    const activeIdx = (): number => enabled().indexOf(it);
    const row = html`<button
      class=${() => cx("dx-menu-item", it.danger && "is-danger", !it.disabled && active() === activeIdx() && "is-active")}
      type="button"
      role="menuitem"
      ?disabled=${it.disabled ?? false}
      @click=${() => choose(it)}
      @mouseenter=${() => !it.disabled && active.set(activeIdx())}
    >${it.icon ? html`<span class="dx-menu-ico" aria-hidden="true">${it.icon}</span>` : ""}<span class="dx-menu-label">${it.label}</span></button>`;
    return it.separator
      ? html`<div class="dx-menu-sep" role="separator"></div>${row}`
      : row;
  };

  return html`<div
    class="dx-dd"
    @keydown=${onKey}
    @focusout=${(e: FocusEvent) => {
      const root = e.currentTarget as HTMLElement;
      const next = e.relatedTarget as Node | null;
      if (!next || !root.contains(next)) close();
    }}
  >
    <button
      class="dx-dd-trigger"
      type="button"
      aria-haspopup="menu"
      aria-expanded=${() => (open() ? "true" : "false")}
      aria-controls=${menuId}
      aria-label=${o.ariaLabel ?? false}
      @click=${() => (open() ? close() : open.set(true))}
    >${() => read(o.label)}<span class="dx-dd-caret" aria-hidden="true">▾</span></button>
    <div class=${cx("dx-menu", `is-${o.align ?? "start"}`)} id=${menuId} role="menu" ?hidden=${() => !open()}>${list(
      () => read(o.items),
      (it) => it.label,
      itemView,
    )}</div>
  </div>`;
}
