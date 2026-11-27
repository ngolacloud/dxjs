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
import { isUrlAttr, sanitizeUrl, isUnsafeProp } from "./escape.ts";

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

// --- JSX bridge -----------------------------------------------------------
// The optional `@dxjs/jsx` runtime compiles <tags>/components into these light
// DESCRIPTORS (a recipe, not a VDOM — instantiated ONCE, then fine-grained
// effects take over, exactly like `html`). This one renderer realizes them into
// real DOM + reactive bindings through the SAME safe sinks, so JSX and html`…`
// interleave freely and all DOM creation stays here (CSP-safe, no eval).

/** Marker for a fragment "tag" (`<>…</>`): renders its children with no wrapper. */
export const Fragment: unique symbol = Symbol.for("dxjs.Fragment");

/** A realized JSX node description produced by `@dxjs/jsx`. */
export interface ElementResult {
  readonly _dxel: true;
  readonly type: string | typeof Fragment | ((props: Record<string, unknown>) => unknown);
  readonly props: Record<string, unknown>;
}

/** Build a JSX descriptor. The jsx-runtime's `jsx`/`jsxs` delegate here. */
export function jsxElement(
  type: ElementResult["type"],
  props: Record<string, unknown> | null,
): ElementResult {
  return { _dxel: true, type, props: props ?? {} };
}

function isElement(v: unknown): v is ElementResult {
  return !!v && typeof v === "object" && (v as { _dxel?: unknown })._dxel === true;
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
  if (name === "ref") {
    // `<el ref=${(el) => …}>` — hand the real node to a callback (same contract
    // as the JSX path's `ref`). Not reactive; fires once at bind time.
    el.removeAttribute(name);
    if (typeof value === "function") (value as (e: Element) => void)(el);
    return;
  }
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
    // Refuse raw-HTML properties (innerHTML/outerHTML/srcdoc): a `.prop` bind must
    // never be an implicit HTML sink — use a dedicated unsafe-HTML seam. (M2)
    if (isUnsafeProp(prop)) return;
    ds.push(effect(() => {
      (el as unknown as Record<string, unknown>)[prop] = val(value);
    }));
    return;
  }
  if (prefix === "?") {
    const attr = name.slice(1);
    el.removeAttribute(name);
    ds.push(effect(() => {
      el.toggleAttribute(attr, !!val(value));
    }));
    return;
  }
  // An on* name without the `@` prefix must NOT become an inline handler — the
  // only event path is @event → addEventListener. Refuse it. (M1)
  if (/^on/i.test(name)) {
    el.removeAttribute(name);
    return;
  }
  ds.push(effect(() => {
    const v = val(value);
    if (v == null || v === false) el.removeAttribute(name);
    else {
      const s = v === true ? "" : String(v);
      // URL-bearing attributes get scheme-sanitised (block javascript:/data:text/html). (H1)
      el.setAttribute(name, isUrlAttr(name) ? sanitizeUrl(s) : s);
    }
  }));
}

function renderOne(v: unknown): Instance {
  if (v == null || v === false || v === true || v === "") {
    return { nodes: [], dispose: () => {} };
  }
  if (isTemplate(v)) return instantiate(v);
  if (isElement(v)) return realize(v);
  const text = document.createTextNode(String(v)); // textContent sink: auto-escaped
  return { nodes: [text], dispose: () => {} };
}

// --- JSX realization (shares every sink/effect with the html path) ---------
const EMPTY: Instance = { nodes: [], dispose: () => {} };

/** camelCase → kebab-case, for style property names. */
function dashCase(k: string): string {
  return k.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
}

/** Form-control attributes that must bind as a live PROPERTY, not an attribute. */
const AS_PROPERTY = new Set(["value", "checked", "selected", "indeterminate"]);

/** Bind one JSX prop to a safe DOM sink. Events are addEventListener (never an
 *  inline handler); reactive values (accessors) and static values both supported. */
function bindProp(el: Element, name: string, value: unknown, ds: Disposer[]): void {
  if (name === "key") return; // consumed by the list/runtime layer
  if (name === "ref") {
    if (typeof value === "function") (value as (e: Element) => void)(el);
    return;
  }
  // Events: onClick / onInput / on:click → addEventListener("click", …).
  if (name.length > 2 && name[0] === "o" && name[1] === "n") {
    const third = name[2] as string;
    const type = third === ":" ? name.slice(3) : third >= "A" && third <= "Z" ? name.slice(2).toLowerCase() : "";
    if (type) {
      if (typeof value === "function") {
        const handler = value as EventListener;
        el.addEventListener(type, handler);
        ds.push(() => el.removeEventListener(type, handler));
      }
      return;
    }
    // An on* name that isn't a recognised camelCase/`on:` event (e.g. lowercase
    // "onclick", often via a `{...spread}`) must NOT become an inline handler. (M1)
    return;
  }
  if (name === "className") name = "class";
  if (name === "style" && value !== null && typeof value === "object" && typeof value !== "function") {
    const style = (el as HTMLElement).style;
    for (const k in value as Record<string, unknown>) {
      style.setProperty(dashCase(k), String((value as Record<string, unknown>)[k]));
    }
    return;
  }
  if (AS_PROPERTY.has(name)) {
    ds.push(effect(() => {
      (el as unknown as Record<string, unknown>)[name] = val(value);
    }));
    return;
  }
  // Generic attribute, with the same boolean/null handling as the html path.
  ds.push(effect(() => {
    const v = val(value);
    if (v == null || v === false) el.removeAttribute(name);
    else {
      const s = v === true ? "" : String(v);
      // URL-bearing attributes get scheme-sanitised (block javascript:/data:text/html). (H1)
      el.setAttribute(name, isUrlAttr(name) ? sanitizeUrl(s) : s);
    }
  }));
}

/** Realize a child (or array/dynamic child) into a fragment and return it. A
 *  dynamic child (accessor or keyed `list`) gets an anchor + the same reactive
 *  child binding the html path uses, so updates stay surgical. */
function realizeChildren(children: unknown): Instance {
  const host = document.createDocumentFragment();
  const ds: Disposer[] = [];
  const add = (c: unknown): void => {
    if (c == null || c === false || c === true || c === "") return;
    if (Array.isArray(c)) {
      for (const x of c) add(x);
      return;
    }
    if (typeof c === "function" || isList(c)) {
      const anchor = document.createComment(CHILD_MARKER);
      host.appendChild(anchor);
      bindChild(anchor, c, ds); // replaces the anchor, wires a reactive slot
      return;
    }
    const inst = renderOne(c);
    for (const n of inst.nodes) host.appendChild(n);
    ds.push(inst.dispose);
  };
  add(children);
  return { nodes: [...host.childNodes], dispose: () => ds.forEach((d) => d()) };
}

function realize(el: ElementResult): Instance {
  const { type, props } = el;
  if (type === Fragment) return realizeChildren(props.children);
  // A component runs ONCE here (inside the active owner) — its output is realized.
  if (typeof type === "function") return renderOne(type(props));
  if (typeof type !== "string") return EMPTY;
  const node = document.createElement(type);
  const ds: Disposer[] = [];
  for (const name in props) {
    if (name === "children") continue;
    bindProp(node, name, props[name], ds);
  }
  if ("children" in props) {
    const kids = realizeChildren(props.children);
    for (const n of kids.nodes) node.appendChild(n);
    ds.push(kids.dispose);
  }
  return { nodes: [node], dispose: () => ds.forEach((d) => d()) };
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
  //
  // Each row is built inside its OWN root, which lives exactly as long as the row.
  // Built directly inside the list effect, the row's bindings would be owned by
  // that effect — and an effect disposes everything it owns every time it re-runs,
  // so the first change to the list would kill the bindings of the rows it keeps.
  // The root also runs `render` untracked: a signal read while building a row
  // never subscribes the list itself.
  if (isList(value)) {
    const lr = value as ListResult<unknown>;
    const rows = new Map<unknown, Instance>();
    const disposeRows = (): void => {
      for (const [, row] of rows) {
        row.dispose();
        for (const n of row.nodes) if (n.parentNode) n.parentNode.removeChild(n);
      }
      rows.clear();
    };
    const buildRow = (item: unknown, i: number): Instance =>
      createRoot((disposeRoot) => {
        try {
          const inst = instantiate(lr.render(item, i));
          return {
            nodes: inst.nodes,
            dispose: () => {
              inst.dispose();
              disposeRoot();
            },
          };
        } catch (err) {
          disposeRoot(); // a row that failed to build leaves no live effects behind
          throw err;
        }
      });
    ds.push(effect(() => {
      const arr = typeof lr.items === "function" ? lr.items() : lr.items;
      const seen = new Set<unknown>();
      const ordered: Instance[] = [];
      arr.forEach((item, i) => {
        const k = lr.key(item, i);
        seen.add(k);
        let row = rows.get(k);
        if (!row) {
          row = buildRow(item, i);
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
    // Row roots are not in the owner tree, so tear them down with the list: when its
    // instance is disposed (`ds`) and, as a backstop, with the scope that built it.
    ds.push(disposeRows);
    onCleanup(disposeRows);
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
 * event listener and nested scope, and removes the rendered nodes. Accepts an
 * html`…` template or a JSX descriptor (`@dxjs/jsx`) — the two interleave.
 */
export function render(view: TemplateResult | ElementResult, host: Element): Disposer {
  return createRoot((dispose) => {
    const inst = renderOne(view);
    for (const n of inst.nodes) host.appendChild(n);
    onCleanup(() => {
      inst.dispose();
      for (const n of inst.nodes) if (n.parentNode) n.parentNode.removeChild(n);
    });
    return dispose;
  });
}
