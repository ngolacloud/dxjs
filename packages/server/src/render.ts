// @dxjs/server — SSR string renderer (DOM-free, edge-ready).
//
// Renders a `html``` view to an HTML string using the SAME escaping discipline
// as the live renderer: text and attribute values are escaped, @event handlers
// are dropped (no server-side listeners), .prop becomes its attribute, ?attr is
// a boolean. Only Web-standard APIs → runs on Node and every edge runtime.
//
// Constraint (same as the client): an interpolation must be the ENTIRE attribute
// value, and @/?/. attributes are written unquoted (`@click=${fn}`).

import { untrack } from "@dxjs/core";
import { escape, type TemplateResult } from "@dxjs/dom";

function isTemplate(v: unknown): v is TemplateResult {
  return !!v && typeof v === "object" && (v as { _dx?: unknown })._dx === true;
}
function unwrap(v: unknown): unknown {
  return typeof v === "function" ? untrack(() => (v as () => unknown)()) : v;
}

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
      } else if (c === "<") inTag = true;
    }
    if (i < strings.length - 1) ctx.push(inTag ? "attr" : "child");
  }
  return ctx;
}

function isList(v: unknown): v is {
  items: (() => unknown[]) | unknown[];
  render: (item: unknown, i: number) => TemplateResult;
} {
  return !!v && typeof v === "object" && (v as { _dxlist?: unknown })._dxlist === true;
}

function childToString(value: unknown): string {
  if (isList(value)) {
    const arr = typeof value.items === "function" ? untrack(() => (value.items as () => unknown[])()) : value.items;
    return arr.map((item, i) => renderToString(value.render(item, i))).join("");
  }
  const v = unwrap(value);
  if (v == null || v === false || v === true || v === "") return "";
  if (isTemplate(v)) return renderToString(v);
  if (Array.isArray(v)) return v.map(childToString).join("");
  return escape(String(v));
}

const ATTR_TAIL = /([.@?]?[A-Za-z_][\w:-]*)=("?)$/;

function appendAttr(out: string, value: unknown): string {
  const m = ATTR_TAIL.exec(out);
  if (!m) return out; // not an attribute binding we recognise; leave as-is
  const name = m[1] as string;
  const quoted = m[2] === '"';
  const v = unwrap(value);
  const prefix = name[0];

  if (prefix === "@") return out.slice(0, m.index); // drop event
  if (prefix === "?") {
    const bare = out.slice(0, m.index);
    return v ? `${bare}${name.slice(1)}` : bare;
  }
  if (prefix === ".") {
    const real = name.slice(1);
    const body = `${out.slice(0, m.index)}${real}="${escape(v)}`;
    return quoted ? body : `${body}"`;
  }
  // normal attribute
  if (v == null || v === false) return out.slice(0, m.index); // omit
  if (v === true) return `${out.slice(0, m.index)}${name}`;
  return quoted ? `${out}${escape(v)}` : `${out.slice(0, m.index)}${name}="${escape(v)}"`;
}

export interface RenderOptions {
  /**
   * Emit hydration markers so `hydrate` can attach reactive bindings to this
   * exact output: `<!--dx:i-->…<!--/dx:i-->` around dynamic children and
   * `data-dxh-i` on elements with a bound attribute/event. Default false.
   */
  hydratable?: boolean;
}

/** Render a view to an HTML string (escaped, CSP-safe markup). */
export function renderToString(view: TemplateResult, options: RenderOptions = {}): string {
  const { strings, values } = view;
  const ctx = scanContexts(strings);
  let out = "";
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) {
      if (ctx[i] === "child") {
        const content = childToString(values[i]); // nested templates render markerless
        out += options.hydratable ? `<!--dx:${i}-->${content}<!--/dx:${i}-->` : content;
      } else {
        out = appendAttr(out, values[i]);
        if (options.hydratable) out += ` data-dxh-${i}=""`;
      }
    }
  }
  return out;
}

/** The per-value binding plan of a template, derived from its static strings. */
export function planParts(
  strings: ReadonlyArray<string>,
): Array<{ kind: "child" } | { kind: "attr"; name: string }> {
  const ctx = scanContexts(strings);
  const parts: Array<{ kind: "child" } | { kind: "attr"; name: string }> = [];
  for (let i = 0; i < ctx.length; i++) {
    if (ctx[i] === "child") parts.push({ kind: "child" });
    else {
      const m = /([.@?]?[A-Za-z_][\w:-]*)=("?)$/.exec(strings[i] as string);
      parts.push({ kind: "attr", name: m ? (m[1] as string) : "" });
    }
  }
  return parts;
}
