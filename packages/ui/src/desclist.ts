// @dxjs/ui/desclist — a key/value description list. Renders a semantic <dl> of
// <dt>/<dd> pairs laid out on a CSS grid: one, two or three columns that collapse
// to a single column on narrow screens (auto-fit minmax), with an optional
// term-beside-value (inline) or term-over-value (stacked) layout. An item can span
// every column. Class-only styling (CSP-safe) — the look lives in CSS; values may
// be reactive accessors.

import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, type Maybe } from "./base.ts";

/** One term/value row of a description list. */
export interface DescItem {
  /** The key/label (left or top). */
  term: string;
  /** The value (right or bottom); plain text, a template, or a reactive accessor. */
  value: Maybe<TemplateResult | string>;
  /** Make this row span every column (e.g. a long note). */
  span?: boolean;
}

export interface DescriptionListOptions {
  items: Maybe<DescItem[]>;
  /** Column count on wide screens (default 1); collapses to 1 when narrow. */
  columns?: 1 | 2 | 3;
  /** "inline" = term beside value (default); "stacked" = term over value. */
  layout?: "stacked" | "inline";
  /** Draw separating rules between rows. */
  bordered?: boolean;
}

/** A description list: `<dl>` of `<dt>`/`<dd>` pairs on a responsive grid. */
export function descriptionList(o: DescriptionListOptions): TemplateResult {
  const cols = o.columns ?? 1;
  const cls = cx(
    "dx-dl",
    `is-cols-${cols}`,
    o.layout === "stacked" ? "is-stacked" : "is-inline",
    o.bordered && "is-bordered",
  );
  return html`<dl class=${cls}>${list(
    () => read(o.items ?? []),
    (it, i) => `${i}:${it.term}`,
    (it) =>
      html`<div class=${cx("dx-dl-item", it.span && "is-span")}>
        <dt class="dx-dl-term">${it.term}</dt>
        <dd class="dx-dl-value">${() => read(it.value ?? "")}</dd>
      </div>`,
  )}</dl>`;
}
