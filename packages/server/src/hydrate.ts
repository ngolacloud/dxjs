// @dxjs/server/hydrate — fine-grained hydration.
//
// Given server HTML produced by `renderToString(view, { hydratable: true })`,
// this attaches dxjs reactivity to the EXISTING nodes instead of re-rendering:
//   - bound attributes/properties/booleans/events are wired onto the element the
//     SSR marked with `data-dxh-i` (first run is idempotent → no flash);
//   - reactive children managed between the `<!--dx:i-->…<!--/dx:i-->` comments
//     the SSR emitted — TEXT, a nested TEMPLATE, or a LIST (array of
//     templates/values). Reactive updates (add/remove/reorder/swap) are reflected
//     surgically and nested scopes are torn down on each change and on dispose.
// Static markup OUTSIDE a managed range is never touched (node identity
// preserved — e.g. a `<ul>` parent of a reactive list stays the same node).
//
// Adoption note: element-producing children are handled by MANAGED REPLACE, not
// in-place adoption. The SSR emits nested templates markerless (no `data-dxh`
// inside a range), so there is nothing to attach fine-grained bindings to. On the
// first effect run we therefore drop the server nodes inside the range and render
// the current value fresh via `@dxjs/dom`; thereafter the range is driven
// reactively. Text children are likewise re-materialised on the first run (same
// content → no visible change). A `list()` child is reconciled BY KEY after the
// first-run rebuild, so rows keep their DOM node identity across add/remove/
// reorder. `hydrateReplace` remains the whole-host fallback.

import { effect, createRoot, onCleanup } from "@dxjs/core";
import { render, type TemplateResult } from "@dxjs/dom";
import { planParts } from "./render.ts";

const COMMENT_NODE = 8;
type Disposer = () => void;

function val(v: unknown): unknown {
  return typeof v === "function" ? (v as () => unknown)() : v;
}

function isTemplate(v: unknown): v is TemplateResult {
  return !!v && typeof v === "object" && (v as { _dx?: unknown })._dx === true;
}

interface ListMarker {
  items: (() => unknown[]) | unknown[];
  key: (item: unknown, index: number) => unknown;
  render: (item: unknown, index: number) => TemplateResult;
}
function isList(v: unknown): v is ListMarker {
  return !!v && typeof v === "object" && (v as { _dxlist?: unknown })._dxlist === true;
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
    ds.push(effect(() => {
      el.toggleAttribute(attr, !!val(value));
    }));
    return;
  }
  ds.push(effect(() => {
    const v = val(value);
    if (v == null || v === false) el.removeAttribute(name);
    else el.setAttribute(name, v === true ? "" : String(v));
  }));
}

// Materialise a single child value (template | primitive | empty) into live
// nodes plus a disposer. A template is rendered via `@dxjs/dom` into a detached
// holder, then its nodes are moved into the managed range; the disposer (which
// tears down the nested effects/listeners and removes the nodes by reference)
// keeps working after the move.
function renderValue(item: unknown): { nodes: ChildNode[]; dispose: Disposer } {
  if (item == null || item === false || item === true || item === "") {
    return { nodes: [], dispose: () => {} };
  }
  if (isTemplate(item)) {
    const holder = document.createElement("div");
    const dispose = render(item, holder);
    return { nodes: Array.from(holder.childNodes), dispose };
  }
  return { nodes: [document.createTextNode(String(item))], dispose: () => {} };
}

function attachChildRange(open: Comment, close: Comment, value: unknown, ds: Disposer[]): void {
  const parent = open.parentNode;
  if (!parent) return;

  // A keyed list: drop the SSR content once, then reconcile by key so rows keep
  // their DOM node identity across add/remove/reorder (same policy as the client
  // renderer's list()).
  if (isList(value)) {
    const lr = value;
    let n = open.nextSibling;
    while (n && n !== close) {
      const next = n.nextSibling;
      parent.removeChild(n);
      n = next;
    }
    const rows = new Map<unknown, { nodes: ChildNode[]; dispose: Disposer }>();
    ds.push(effect(() => {
      const arr = typeof lr.items === "function" ? lr.items() : lr.items;
      const seen = new Set<unknown>();
      const ordered: Array<{ nodes: ChildNode[]; dispose: Disposer }> = [];
      arr.forEach((item, i) => {
        const k = lr.key(item, i);
        seen.add(k);
        let row = rows.get(k);
        if (!row) {
          row = renderValue(lr.render(item, i));
          rows.set(k, row);
        }
        ordered.push(row);
      });
      for (const [k, row] of rows) {
        if (!seen.has(k)) {
          row.dispose();
          for (const node of row.nodes) if (node.parentNode) node.parentNode.removeChild(node);
          rows.delete(k);
        }
      }
      for (const row of ordered) for (const node of row.nodes) parent.insertBefore(node, close);
    }));
    ds.push(() => {
      for (const [, row] of rows) row.dispose();
      rows.clear();
    });
    return;
  }

  // Otherwise only reactive (function) children need wiring; a static child keeps
  // its SSR output.
  if (typeof value !== "function") return;

  let current: ChildNode[] = [];
  let currentDisposers: Disposer[] = [];
  let adopted = false;

  // Remove the nodes we currently manage (and tear down their nested scopes).
  const clearManaged = (): void => {
    for (const d of currentDisposers) d();
    currentDisposers = [];
    for (const n of current) if (n.parentNode) n.parentNode.removeChild(n);
    current = [];
  };

  // Drop whatever the server emitted inside the range (done once, on first run —
  // element content cannot be adopted in place because it is markerless).
  const clearSsr = (): void => {
    let n = open.nextSibling;
    while (n && n !== close) {
      const next = n.nextSibling;
      parent.removeChild(n);
      n = next;
    }
  };

  const insert = (v: unknown): void => {
    const items = Array.isArray(v) ? v : [v];
    for (const item of items) {
      const inst = renderValue(item);
      for (const n of inst.nodes) parent.insertBefore(n, close);
      current.push(...inst.nodes);
      currentDisposers.push(inst.dispose);
    }
  };

  ds.push(effect(() => {
    const v = val(value);
    clearManaged();
    if (!adopted) {
      clearSsr();
      adopted = true;
    }
    insert(v);
  }));
  ds.push(clearManaged);
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
        if (open && close) attachChildRange(open, close, value, ds);
      }
    }
    onCleanup(() => {
      for (const d of ds) d();
    });
    return dispose;
  });
}

/**
 * Whole-host fallback: clear the host and render fresh. `hydrate` now manages
 * reactive element/list children itself (via managed replace), so reach for this
 * only when you deliberately want to discard the entire SSR tree and re-render.
 */
export function hydrateReplace(view: TemplateResult, host: Element): Disposer {
  host.textContent = "";
  return render(view, host);
}
