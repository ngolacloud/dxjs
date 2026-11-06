// @dxjs/dom — the safe, reactive renderer.
//
// `html` is a tagged template compiled ONCE into a <template> (the only
// innerHTML, over developer string literals — never data — so it is CSP-safe and
// not an XSS vector). Runtime values are bound through SAFE DOM sinks only:
//   - text children  -> textContent (auto-escaped)
//   - attributes      -> setAttribute (auto-escaped)
//   - .prop           -> element property
//   - ?attr           -> toggleAttribute (boolean)
//   - @event          -> addEventListener (NEVER an inline on*= attribute)
// Reactive bindings wrap a `@dxjs/core` effect, so updates are surgical and
// everything is torn down by the owning scope. No eval, no document.write, no
// innerHTML of data, no inline handlers → runs under a strict CSP.

import { effect, createRoot, onCleanup } from "@dxjs/core";

const ATTR_MARKER = "__dxm_attr__";
const CHILD_MARKER = "dxm";
const ELEMENT_NODE = 1;
const COMMENT_NODE = 8;

export interface TemplateResult {
  readonly _dx: true;
  readonly strings: TemplateStringsArray;
  readonly values: unknown[];
}

/** Tag for authoring views: html`<div>${reactiveOrStatic}</div>`. */
export function html(strings: TemplateStringsArray, ...values: unknown[]): TemplateResult {
  return { _dx: true, strings, values };
}

function isTemplate(v: unknown): v is TemplateResult {
  return !!v && typeof v === "object" && (v as { _dx?: unknown })._dx === true;
}

// --- compile (once per call-site) ----------------------------------------
const cache = new WeakMap<TemplateStringsArray, HTMLTemplateElement>();

/** Decide, for each interpolation gap, whether it sits in a tag (attribute) or in text. */
function scanContexts(strings: ReadonlyArray<string>): Array<"attr" | "child"> {
  const ctx: Array<"attr" | "child"> = [];
  let inTag = false;
  let quote = "";
  for (let i = 0; i < strings.length; i++) {
    const s = strings[i] as string;
    for (let j = 0; j < s.length; j++) {
      const c = s[j];
      if (quote) {
        if (c === quote) quote = "";
      } else if (inTag) {
        if (c === '"' || c === "'") quote = c;
        else if (c === ">") inTag = false;
      } else if (c === "<") {
        inTag = true;
      }
    }
    if (i < strings.length - 1) ctx.push(inTag ? "attr" : "child");
  }
  return ctx;
}

function compile(strings: TemplateStringsArray): HTMLTemplateElement {
  const hit = cache.get(strings);
  if (hit) return hit;
  const ctx = scanContexts(strings);
  let markup = "";
  for (let i = 0; i < strings.length; i++) {
    markup += strings[i];
    if (i < strings.length - 1) {
      markup += ctx[i] === "child" ? `<!--${CHILD_MARKER}-->` : ATTR_MARKER;
    }
  }
  const tpl = document.createElement("template");
  tpl.innerHTML = markup; // dx-allow-innerHTML: static template literal, never data
  cache.set(strings, tpl);
  return tpl;
}

type Disposer = () => void;

interface Instance {
  nodes: ChildNode[];
  dispose: Disposer;
}

function val(v: unknown): unknown {
  return typeof v === "function" ? (v as () => unknown)() : v;
}

// --- binding --------------------------------------------------------------
function bindAttr(el: Element, name: string, value: unknown, ds: Disposer[]): void {
  const prefix = name[0];
  if (prefix === "@") {
    const type = name.slice(1);
    el.removeAttribute(name);
    if (typeof value === "function") {
      const handler = value as EventListener;
      el.addEventListener(type, handler);
      ds.push(() => el.removeEventListener(type, handler));
    }
    return;
  }
  if (prefix === ".") {
    const prop = name.slice(1);
    el.removeAttribute(name);
    ds.push(effect(() => {
      (el as unknown as Record<string, unknown>)[prop] = val(value);
    }));
    return;
  }
  if (prefix === "?") {
    const attr = name.slice(1);
    el.removeAttribute(name);
    ds.push(effect(() => el.toggleAttribute(attr, !!val(value))));
    return;
  }
  ds.push(effect(() => {
    const v = val(value);
    if (v == null || v === false) el.removeAttribute(name);
    else el.setAttribute(name, v === true ? "" : String(v));
  }));
}

function renderOne(v: unknown): Instance {
  if (v == null || v === false || v === true || v === "") {
    return { nodes: [], dispose: () => {} };
  }
  if (isTemplate(v)) return instantiate(v);
  const text = document.createTextNode(String(v)); // textContent sink: auto-escaped
  return { nodes: [text], dispose: () => {} };
}

/** A keyed list: reconciled by `key` so stable rows keep their DOM node identity
 * across add/remove/reorder (new rows rendered, gone rows disposed, no full
 * rebuild). Use as a child: html`<ul>${list(items, (i) => i.id, (i) => html`…`)}</ul>`. */
export interface ListResult<T> {
  readonly _dxlist: true;
  readonly items: (() => T[]) | T[];
  readonly key: (item: T, index: number) => unknown;
  readonly render: (item: T, index: number) => TemplateResult;
}
export function list<T>(
  items: (() => T[]) | T[],
  key: (item: T, index: number) => unknown,
  render: (item: T, index: number) => TemplateResult,
): ListResult<T> {
  return { _dxlist: true, items, key, render };
}
function isList(v: unknown): v is ListResult<unknown> {
  return !!v && typeof v === "object" && (v as { _dxlist?: unknown })._dxlist === true;
}

function bindChild(comment: ChildNode, value: unknown, ds: Disposer[]): void {
  const parent = comment.parentNode as ParentNode & Node;
  const anchor = document.createTextNode("");
  parent.insertBefore(anchor, comment);
  parent.removeChild(comment);

  // The live parent AT INSERT TIME. A top-level child binding is first instantiated
  // inside the template's DocumentFragment, then render()/mount() MOVES the nodes
  // (anchor included) into the host — so the original `parent` becomes stale. The
  // anchor always travels with its siblings, so its current parent is authoritative.
  const into = (): ParentNode & Node => (anchor.parentNode as (ParentNode & Node) | null) ?? parent;

  let current: ChildNode[] = [];
  let currentDisposers: Disposer[] = [];

  const clear = (): void => {
    for (const d of currentDisposers) d();
    currentDisposers = [];
    for (const n of current) if (n.parentNode) n.parentNode.removeChild(n);
    current = [];
  };

  const place = (v: unknown): void => {
    const items = Array.isArray(v) ? v : [v];
    const host = into();
    for (const item of items) {
      const inst = renderOne(item);
      for (const n of inst.nodes) host.insertBefore(n, anchor);
      current.push(...inst.nodes);
      currentDisposers.push(inst.dispose);
    }
  };

  // Keyed list: reuse rows by key (identity preserved), reorder by moving nodes.
  if (isList(value)) {
    const lr = value as ListResult<unknown>;
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
          const inst = instantiate(lr.render(item, i));
          row = { nodes: inst.nodes, dispose: inst.dispose };
          rows.set(k, row);
        }
        ordered.push(row);
      });
      for (const [k, row] of rows) {
        if (!seen.has(k)) {
          row.dispose();
          for (const n of row.nodes) if (n.parentNode) n.parentNode.removeChild(n);
          rows.delete(k);
        }
      }
      const host = into();
      for (const row of ordered) for (const n of row.nodes) host.insertBefore(n, anchor);
    }));
    ds.push(() => {
      for (const [, row] of rows) row.dispose();
      rows.clear();
    });
    return;
  }

  ds.push(effect(() => {
    const v = val(value);
    clear();
    place(v);
  }));
  ds.push(clear);
}

function walk(node: Node, values: unknown[], idx: { v: number }, ds: Disposer[]): void {
  if (node.nodeType === ELEMENT_NODE) {
    const el = node as Element;
    for (const attr of [...el.attributes]) {
      if (attr.value === ATTR_MARKER) {
        bindAttr(el, attr.name, values[idx.v++], ds);
      } else if (attr.value.includes(ATTR_MARKER)) {
        throw new Error("dxjs: an interpolation must be the entire attribute value");
      }
    }
  }
  for (const child of [...node.childNodes]) {
    if (child.nodeType === COMMENT_NODE && (child as Comment).data === CHILD_MARKER) {
      bindChild(child, values[idx.v++], ds);
    } else {
      walk(child, values, idx, ds);
    }
  }
}

function instantiate(view: TemplateResult): Instance {
  const tpl = compile(view.strings);
  const frag = tpl.content.cloneNode(true) as DocumentFragment;
  const ds: Disposer[] = [];
  walk(frag, view.values, { v: 0 }, ds);
  const nodes = [...frag.childNodes];
  return {
    nodes,
    dispose: () => {
      for (const d of ds) d();
    },
  };
}

/**
 * Render a view into `host` and return a disposer that tears down every effect,
 * event listener and nested scope, and removes the rendered nodes.
 */
export function render(view: TemplateResult, host: Element): Disposer {
  return createRoot((dispose) => {
    const inst = instantiate(view);
    for (const n of inst.nodes) host.appendChild(n);
    onCleanup(() => {
      inst.dispose();
      for (const n of inst.nodes) if (n.parentNode) n.parentNode.removeChild(n);
    });
    return dispose;
  });
}
