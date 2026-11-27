// @dxjs/ui/sheet — mobile-first bottom surfaces: a bottom sheet (a panel that
// slides up from the bottom over a backdrop) and an action sheet (a stack of
// large touch actions plus a cancel row). Class-only styling (CSP-safe): the
// slide is a CSS transform toggled by the `is-open` class, never an inline
// style. Both close on Escape and a backdrop click; no document-level listeners.

import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, nextId, cx, type Maybe } from "./base.ts";
import { icon, type IconName } from "./icons.ts";

// --- Bottom sheet ----------------------------------------------------------
export interface BottomSheetOptions {
  open: Maybe<boolean>;
  onClose?: () => void;
  title?: string;
  body: Maybe<TemplateResult | string>;
  footer?: Maybe<TemplateResult>;
}

/** A panel that slides up from the bottom edge over a backdrop. A grab handle
 *  sits at the top; Escape and a backdrop click call `onClose`. Hidden when
 *  `open` is false. The slide is the `is-open` class toggling a CSS transform —
 *  no inline styles, so it runs under `style-src 'self'`. role=dialog. */
export function bottomSheet(o: BottomSheetOptions): TemplateResult {
  const titleId = o.title ? nextId("dx-sheet") : "";
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") o.onClose?.();
  };
  return html`<div
    class=${() => cx("dx-sheet-root", read(o.open) && "is-open")}
    ?hidden=${() => !read(o.open)}
    @keydown=${onKey}
  >
    <div class="dx-sheet-backdrop" @click=${() => o.onClose?.()}></div>
    <section
      class="dx-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby=${titleId || false}
    >
      <div class="dx-sheet-grab" aria-hidden="true"></div>
      ${o.title
        ? html`<header class="dx-sheet-head"><h2 class="dx-sheet-title" id=${titleId}>${o.title}</h2><button class="dx-sheet-x" type="button" aria-label="Close" @click=${() => o.onClose?.()}>${icon("x", { size: 18 })}</button></header>`
        : ""}
      <div class="dx-sheet-body">${() => read(o.body)}</div>
      ${o.footer ? html`<footer class="dx-sheet-foot">${() => read(o.footer!)}</footer>` : ""}
    </section>
  </div>`;
}

// --- Action sheet ----------------------------------------------------------
export interface SheetAction {
  label: string;
  icon?: IconName;
  onSelect?: () => void;
  /** Style as a destructive action. */
  danger?: boolean;
  disabled?: boolean;
}
export interface ActionSheetOptions {
  open: Maybe<boolean>;
  onClose?: () => void;
  title?: string;
  actions: Maybe<SheetAction[]>;
  /** Label for the cancel row (default "Cancel"). */
  cancelLabel?: string;
}

/** A bottom stack of large touch actions plus a cancel row. Escape, a backdrop
 *  click, and the cancel row all call `onClose`; selecting an action fires it
 *  then closes. Hidden when `open` is false. role=menu / menuitem throughout. */
export function actionSheet(o: ActionSheetOptions): TemplateResult {
  const titleId = o.title ? nextId("dx-as") : "";
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") o.onClose?.();
  };
  const choose = (a: SheetAction): void => {
    if (a.disabled) return;
    a.onSelect?.();
    o.onClose?.();
  };
  const actionView = (a: SheetAction): TemplateResult =>
    html`<button
      class=${cx("dx-as-item", a.danger && "is-danger")}
      type="button"
      role="menuitem"
      ?disabled=${a.disabled ?? false}
      @click=${() => choose(a)}
    >${a.icon ? html`<span class="dx-as-ico" aria-hidden="true">${icon(a.icon, { size: 20 })}</span>` : ""}<span class="dx-as-label">${a.label}</span></button>`;

  return html`<div
    class=${() => cx("dx-as-root", read(o.open) && "is-open")}
    ?hidden=${() => !read(o.open)}
    @keydown=${onKey}
  >
    <div class="dx-as-backdrop" @click=${() => o.onClose?.()}></div>
    <div class="dx-as-dock" role="menu" aria-label=${o.title ?? "Actions"}>
      <div class="dx-as-grab" aria-hidden="true"></div>
      <div class="dx-as-sheet">
        ${o.title ? html`<div class="dx-as-title" id=${titleId} role="presentation">${o.title}</div>` : ""}
        ${list(
          () => read(o.actions),
          (a, i) => `${i}:${a.label}`,
          actionView,
        )}
      </div>
      <button class="dx-as-cancel" type="button" @click=${() => o.onClose?.()}>${o.cancelLabel ?? "Cancel"}</button>
    </div>
  </div>`;
}
