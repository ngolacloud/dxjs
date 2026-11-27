// @dxjs/ui/popover — anchored floating surfaces: a generic popover, a confirm
// bubble and a right-click context menu. Class-only styling (CSP-safe): the look
// lives in CSS, components only toggle classes. Each surface closes on focus
// leaving its root (focusout) and on Escape — no document-level listeners to
// leak. The context menu is positioned at the pointer through CSS custom
// properties set with a `ref` effect (`el.style.setProperty("--dx-cm-x", …)`),
// never an inline `style=` attribute, so it runs under `style-src 'self'`.

import { signal, onCleanup } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, nextId, cx, type Maybe, type Tone } from "./base.ts";
import { button } from "./controls.ts";
import { icon, type IconName } from "./icons.ts";

/** Close the root when focus moves outside it (no document-level listener). */
const closeOnFocusOut = (e: FocusEvent, close: () => void): void => {
  const root = e.currentTarget as HTMLElement;
  const next = e.relatedTarget as Node | null;
  if (!next || !root.contains(next)) close();
};

// --- Popover ---------------------------------------------------------------
export interface PopoverOptions {
  /** The clickable anchor; wrapped in a button that toggles the panel. */
  trigger: TemplateResult | string;
  /** Floating panel contents. */
  content: Maybe<TemplateResult | string>;
  /** Side the panel sits on, relative to the trigger (default "bottom"). */
  placement?: "top" | "bottom" | "left" | "right";
  /** Cross-axis alignment to the trigger's start (default) or end edge. */
  align?: "start" | "end";
  ariaLabel?: string;
}

/** A button-anchored floating panel. Opens on click, closes on a second click,
 *  Escape, or focus leaving the root. The panel is role="dialog". */
export function popover(o: PopoverOptions): TemplateResult {
  const open = signal(false);
  const panelId = nextId("dx-pop");
  const close = (): void => {
    open.set(false);
  };

  return html`<div
    class="dx-pop"
    @keydown=${(e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    }}
    @focusout=${(e: FocusEvent) => closeOnFocusOut(e, close)}
  >
    <button
      class="dx-pop-trigger"
      type="button"
      aria-haspopup="dialog"
      aria-expanded=${() => (open() ? "true" : "false")}
      aria-controls=${panelId}
      aria-label=${o.ariaLabel ?? false}
      @click=${() => (open() ? close() : open.set(true))}
    >${o.trigger}</button>
    <div
      class=${cx("dx-pop-panel", `is-${o.placement ?? "bottom"}`, `is-align-${o.align ?? "start"}`)}
      id=${panelId}
      role="dialog"
      aria-label=${o.ariaLabel ?? false}
      ?hidden=${() => !open()}
    >${() => read(o.content ?? "")}</div>
  </div>`;
}

// --- Popconfirm ------------------------------------------------------------
export interface PopconfirmOptions {
  trigger: TemplateResult | string;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Tone of the confirm action (default "neg" → a destructive confirm). */
  tone?: Tone;
  onConfirm: () => void;
  onCancel?: () => void;
}

/** A popover that asks for confirmation before a (usually destructive) action.
 *  The panel shows a title, an optional message and Cancel / Confirm buttons.
 *  Escape and the Cancel button both cancel; confirming runs `onConfirm`. */
export function popconfirm(o: PopconfirmOptions): TemplateResult {
  const open = signal(false);
  const panelId = nextId("dx-pop");
  const titleId = nextId("dx-pop-t");
  const tone: Tone = o.tone ?? "neg";
  const close = (): void => {
    open.set(false);
  };
  const confirm = (): void => {
    o.onConfirm();
    close();
  };
  const cancel = (): void => {
    o.onCancel?.();
    close();
  };
  // Map the tone onto a button variant for the confirm action.
  const confirmVariant = tone === "neg" ? "danger" : "primary";

  return html`<div
    class="dx-pop"
    @keydown=${(e: KeyboardEvent) => {
      if (e.key === "Escape") cancel();
    }}
    @focusout=${(e: FocusEvent) => closeOnFocusOut(e, close)}
  >
    <button
      class="dx-pop-trigger"
      type="button"
      aria-haspopup="dialog"
      aria-expanded=${() => (open() ? "true" : "false")}
      aria-controls=${panelId}
      @click=${() => (open() ? close() : open.set(true))}
    >${o.trigger}</button>
    <div
      class=${cx("dx-pop-panel", "dx-popconfirm", `is-${tone}`, "is-bottom", "is-align-start")}
      id=${panelId}
      role="dialog"
      aria-labelledby=${titleId}
      ?hidden=${() => !open()}
    >
      <div class="dx-popconfirm-head">
        <span class="dx-popconfirm-ico" aria-hidden="true">${icon("alert", { size: 18 })}</span>
        <p class="dx-popconfirm-title" id=${titleId}>${o.title}</p>
      </div>
      ${o.message ? html`<p class="dx-popconfirm-msg">${o.message}</p>` : ""}
      <div class="dx-popconfirm-actions">
        ${button({ label: o.cancelLabel ?? "Cancel", variant: "subtle", size: "sm", onClick: () => cancel() })}
        ${button({ label: o.confirmLabel ?? "Confirm", variant: confirmVariant, size: "sm", onClick: () => confirm() })}
      </div>
    </div>
  </div>`;
}

// --- Context menu ----------------------------------------------------------
export interface ContextMenuItem {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  disabled?: boolean;
  /** Style as a destructive action. */
  danger?: boolean;
  /** Render a dividing rule *before* this item. */
  separator?: boolean;
}
export interface ContextMenuOptions {
  /** The region that owns the right-click menu. */
  children: TemplateResult | string;
  items: ContextMenuItem[];
  ariaLabel?: string;
}

/** Wrap a region with a right-click (context) menu. The default browser menu is
 *  suppressed; our menu opens at the pointer — its position is handed in through
 *  `--dx-cm-x` / `--dx-cm-y` custom properties set with a ref effect. Arrow keys
 *  move the active item; Enter/Space fires it. Closes on select, Escape, or
 *  focus leaving the root. role=menu / menuitem throughout. */
export function contextMenu(o: ContextMenuOptions): TemplateResult {
  const open = signal(false);
  const active = signal(-1);
  const menuId = nextId("dx-cm");
  let menuEl: HTMLElement | null = null;

  const enabled = (): ContextMenuItem[] => o.items.filter((it) => !it.disabled);
  const close = (): void => {
    open.set(false);
    active.set(-1);
  };
  const choose = (it: ContextMenuItem): void => {
    if (it.disabled) return;
    it.onSelect();
    close();
  };
  const step = (delta: number): void => {
    const rows = enabled();
    if (rows.length === 0) return;
    const curr = active();
    const next = curr < 0 ? (delta > 0 ? 0 : rows.length - 1) : (curr + delta + rows.length) % rows.length;
    active.set(next);
  };

  const onContext = (e: MouseEvent): void => {
    e.preventDefault();
    if (menuEl) {
      menuEl.style.setProperty("--dx-cm-x", `${e.clientX}px`);
      menuEl.style.setProperty("--dx-cm-y", `${e.clientY}px`);
    }
    active.set(-1);
    open.set(true);
    // Move focus into the menu so Escape / focusout have an anchor.
    menuEl?.focus();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      step(-1);
    } else if ((e.key === "Enter" || e.key === " ") && open() && active() >= 0) {
      e.preventDefault();
      const it = enabled()[active()];
      if (it) choose(it);
    }
  };

  // Deterministic teardown: drop the captured node reference on owner cleanup.
  onCleanup(() => {
    menuEl = null;
  });

  const itemView = (it: ContextMenuItem, i: number): TemplateResult => {
    const activeIdx = (): number => enabled().indexOf(it);
    const row = html`<button
      class=${() => cx("dx-cm-item", it.danger && "is-danger", !it.disabled && active() === activeIdx() && "is-active")}
      type="button"
      role="menuitem"
      ?disabled=${it.disabled ?? false}
      @click=${() => choose(it)}
      @mouseenter=${() => !it.disabled && active.set(activeIdx())}
    >${it.icon ? html`<span class="dx-cm-ico" aria-hidden="true">${icon(it.icon, { size: 16 })}</span>` : ""}<span class="dx-cm-label">${it.label}</span></button>`;
    return it.separator
      ? html`<div class="dx-cm-sep" role="separator"></div>${row}`
      : row;
  };

  return html`<div
    class="dx-cm-root"
    @contextmenu=${onContext}
    @keydown=${onKey}
    @focusout=${(e: FocusEvent) => closeOnFocusOut(e, close)}
  >
    <div class="dx-cm-slot">${o.children}</div>
    <div
      class="dx-cm"
      id=${menuId}
      role="menu"
      tabindex="-1"
      aria-label=${o.ariaLabel ?? false}
      ref=${(el: Element) => (menuEl = el as HTMLElement)}
      ?hidden=${() => !open()}
    >${list(
      () => o.items,
      (it, i) => `${i}:${it.label}`,
      itemView,
    )}</div>
  </div>`;
}
