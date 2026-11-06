// @dxjs/server/hydrate — fine-grained hydration.
//
// Given server HTML produced by `renderToString(view, { hydratable: true })`,
// this attaches dxjs reactivity to the EXISTING nodes instead of re-rendering:
//   - bound attributes/properties/booleans/events are wired onto the element the
//     SSR marked with `data-dxh-i` (first run is idempotent → no flash);
//   - reactive TEXT children are managed between the `<!--dx:i-->…<!--/dx:i-->`
//     comments the SSR emitted.
// Static markup is never touched (node identity preserved).
//
// Scope: reactive children that produce ELEMENTS (nested templates / lists) are
// not attached here — they keep their SSR output. Use `hydrateReplace` when you
// need full reactive fidelity over such content.

import { effect, createRoot, onCleanup } from "@dxjs/core";
import { render, type TemplateResult } from "@dxjs/dom";
import { planParts } from "./render.ts";

const COMMENT_NODE = 8;
type Disposer = () => void;

function val(v: unknown): unknown {
  return typeof v === "function" ? (v as () => unknown)() : v;
}

function collectComments(root: Node, out: Comment[]): void {
  for (const n of Array.from(root.childNodes)) {
    if (n.nodeType === COMMENT_NODE) out.push(n as Comment);
    else collectComments(n, out);
  }
}

function attachAttr(el: Element, name: string, value: unknown, ds: Disposer[]): void {
  const prefix = name[0];
  if (prefix === "@") {
    if (typeof value === "function") {
      const h = value as EventListener;
      el.addEventListener(name.slice(1), h);
      ds.push(() => el.removeEventListener(name.slice(1), h));
    }
    return;
  }
  if (prefix === ".") {
    const prop = name.slice(1);
    ds.push(effect(() => {
      (el as unknown as Record<string, unknown>)[prop] = val(value);
    }));
    return;
  }
  if (prefix === "?") {
    const attr = name.slice(1);
    ds.push(effect(() => el.toggleAttribute(attr, !!val(value))));
    return;
  }
  ds.push(effect(() => {
    const v = val(value);
    if (v == null || v === false) el.removeAttribute(name);
    else el.setAttribute(name, v === true ? "" : String(v));
  }));
}

function attachTextRange(open: Comment, close: Comment, value: unknown, ds: Disposer[]): void {
  // Only reactive values need wiring; a static child keeps its SSR text.
  if (typeof value !== "function") return;
  const parent = open.parentNode;
  if (!parent) return;
  const clear = (): void => {
    let n = open.nextSibling;
    while (n && n !== close) {
      const next = n.nextSibling;
      parent.removeChild(n);
      n = next;
    }
  };
  ds.push(effect(() => {
    const v = val(value);
    clear();
    const text = v == null || v === false || v === true ? "" : String(v);
    parent.insertBefore(document.createTextNode(text), close);
  }));
}

/**
 * Fine-grained hydration over `renderToString(view, { hydratable: true })`
 * output already present under `host`. Returns a disposer.
 */
export function hydrate(view: TemplateResult, host: Element): Disposer {
  const parts = planParts(view.strings);
  return createRoot((dispose) => {
    const ds: Disposer[] = [];
    const comments: Comment[] = [];
    collectComments(host, comments);

    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const value = view.values[i];
      if (p!.kind === "attr") {
        const sel = `[data-dxh-${i}]`;
        const el = host.querySelector(sel) ?? (host.matches?.(sel) ? host : null);
        if (el) {
          el.removeAttribute(`data-dxh-${i}`);
          attachAttr(el, (p as { name: string }).name, value, ds);
        }
      } else {
        const open = comments.find((c) => c.data === `dx:${i}`);
        const close = comments.find((c) => c.data === `/dx:${i}`);
        if (open && close) attachTextRange(open, close, value, ds);
      }
    }
    onCleanup(() => {
      for (const d of ds) d();
    });
    return dispose;
  });
}

/**
 * Full-fidelity fallback: clear the host and render fresh. Use when the view has
 * reactive element-producing children (nested templates/lists) that the
 * fine-grained `hydrate` does not attach.
 */
export function hydrateReplace(view: TemplateResult, host: Element): Disposer {
  host.textContent = "";
  return render(view, host);
}
