// @dxjs/ui/pagination — a standalone pager. Previous/next buttons (disabled at
// the ends), numbered page buttons with an ellipsis gap around the current page,
// an optional "X–Y of Z" range label and an optional rows-per-page <select>.
//
// Class-only, reactive, CSP-safe: components toggle CLASSES and use safe sinks
// (@event, .value, ?attr); an attribute bound to `false` is omitted. The window
// of page numbers is computed from `siblingCount` (+ boundary pages when
// `showEdges`), so a long range collapses to e.g. `1 … 9 10 11 … 20`.

import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, sizeClass, type Maybe, type Size } from "./base.ts";
import { icon } from "./icons.ts";

export interface PaginationOptions {
  /** Current page, 0-based. */
  page?: Maybe<number>;
  /** Total number of pages. Derived from `total`/`pageSize` when omitted. */
  pageCount?: Maybe<number>;
  /** Called with the next 0-based page when the user navigates. */
  onPage?: (page: number) => void;
  /** Pages shown on each side of the current one (default 1). */
  siblingCount?: number;
  /** Always pin the first & last page button (default true). */
  showEdges?: boolean;
  /** Total item count — used to derive `pageCount` and the range label. */
  total?: Maybe<number>;
  /** Items per page — used to derive `pageCount` and the range label. */
  pageSize?: Maybe<number>;
  /** Choices for the rows-per-page <select>. Omit to hide the select. */
  pageSizes?: number[];
  /** Called when the rows-per-page select changes. */
  onPageSize?: (size: number) => void;
  /** Show the "X–Y of Z" label (needs `total` + `pageSize`). */
  labelRange?: boolean;
  /** Density tier. */
  size?: Size;
  /** Accessible name for the nav (default "Pagination"). */
  ariaLabel?: string;
}

/** One rendered slot: a 1-based page number or an ellipsis marker. */
type PageItem = number | "start-ellipsis" | "end-ellipsis";

const range = (start: number, end: number): number[] =>
  start > end ? [] : Array.from({ length: end - start + 1 }, (_, i) => start + i);

/** Compute the visible slots for a 1-based `page` within `count` pages. The
 *  classic boundary/sibling window: boundary pages, a sibling block around the
 *  current page, and an ellipsis wherever a gap of more than one page appears. */
function windowOf(count: number, page: number, siblingCount: number, boundaryCount: number): PageItem[] {
  const startPages = range(1, Math.min(boundaryCount, count));
  const endPages = range(Math.max(count - boundaryCount + 1, boundaryCount + 1), count);

  const siblingsStart = Math.max(
    Math.min(page - siblingCount, count - boundaryCount - siblingCount * 2 - 1),
    boundaryCount + 2,
  );
  const siblingsEnd = Math.min(
    Math.max(page + siblingCount, boundaryCount + siblingCount * 2 + 2),
    endPages.length > 0 ? endPages[0]! - 2 : count - 1,
  );

  return [
    ...startPages,
    ...(siblingsStart > boundaryCount + 2
      ? (["start-ellipsis"] as PageItem[])
      : boundaryCount + 1 < count - boundaryCount
        ? [boundaryCount + 1]
        : []),
    ...range(siblingsStart, siblingsEnd),
    ...(siblingsEnd < count - boundaryCount - 1
      ? (["end-ellipsis"] as PageItem[])
      : count - boundaryCount > boundaryCount
        ? [count - boundaryCount]
        : []),
    ...endPages,
  ];
}

/** A standalone pager. Controlled via `page` + `onPage` (both 0-based). Renders
 *  prev/next, numbered buttons with ellipsis gaps, and `aria-current="page"` on
 *  the active one, inside `nav[aria-label="Pagination"]`. */
export function pagination(o: PaginationOptions): TemplateResult {
  const siblingCount = Math.max(0, o.siblingCount ?? 1);
  const boundaryCount = (o.showEdges ?? true) ? 1 : 0;

  const pageCount = (): number => {
    const pc = read(o.pageCount);
    if (pc != null) return Math.max(1, Math.floor(pc));
    const total = read(o.total ?? 0);
    const size = read(o.pageSize ?? 0);
    return total > 0 && size > 0 ? Math.max(1, Math.ceil(total / size)) : 1;
  };
  const current = (): number => {
    const last = pageCount() - 1;
    return Math.min(Math.max(0, Math.floor(read(o.page ?? 0))), last);
  };

  const go = (p: number): void => {
    const clamped = Math.min(Math.max(0, p), pageCount() - 1);
    if (clamped !== current()) o.onPage?.(clamped);
  };

  const slots = (): PageItem[] => windowOf(pageCount(), current() + 1, siblingCount, boundaryCount);

  const rangeLabel = (): string => {
    const total = read(o.total ?? 0);
    const size = read(o.pageSize ?? 0);
    if (total <= 0 || size <= 0) return "";
    const start = current() * size + 1;
    const end = Math.min(total, (current() + 1) * size);
    // en-dash between the bounds.
    return `${start}–${end} of ${total}`;
  };

  const sizes = o.pageSizes ?? [];

  const slotView = (it: PageItem): TemplateResult =>
    typeof it === "number"
      ? html`<button
          class=${() => cx("dx-pg-btn", "dx-pg-page", it - 1 === current() && "is-current")}
          type="button"
          aria-label=${`Page ${it}`}
          aria-current=${() => (it - 1 === current() ? "page" : false)}
          @click=${() => go(it - 1)}
        >${it}</button>`
      : html`<span class="dx-pg-gap" aria-hidden="true">…</span>`;

  return html`<nav class=${cx("dx-pg", sizeClass(o.size))} aria-label=${o.ariaLabel ?? "Pagination"}>
    ${() =>
      o.labelRange && rangeLabel()
        ? html`<span class="dx-pg-range" aria-live="polite">${rangeLabel()}</span>`
        : ""}
    <div class="dx-pg-pages">
      <button
        class="dx-pg-btn dx-pg-nav dx-pg-prev"
        type="button"
        aria-label="Previous page"
        ?disabled=${() => current() <= 0}
        @click=${() => go(current() - 1)}
      >${icon("chevron-right")}</button>
      ${list(
        () => slots(),
        (it, i) => (typeof it === "number" ? `p${it}` : `${it}-${i}`),
        (it) => slotView(it),
      )}
      <button
        class="dx-pg-btn dx-pg-nav dx-pg-next"
        type="button"
        aria-label="Next page"
        ?disabled=${() => current() >= pageCount() - 1}
        @click=${() => go(current() + 1)}
      >${icon("chevron-right")}</button>
    </div>
    ${sizes.length > 0
      ? html`<label class="dx-pg-size">
          <span class="dx-pg-size-label">Rows</span>
          <select
            class="dx-pg-select"
            aria-label="Rows per page"
            @change=${(e: Event) => o.onPageSize?.(Number((e.target as HTMLSelectElement).value))}
          >${list(
            () => sizes,
            (n) => String(n),
            (n) =>
              html`<option value=${String(n)} .selected=${() => read(o.pageSize ?? sizes[0]) === n}>${String(n)}</option>`,
          )}</select>
        </label>`
      : ""}
  </nav>`;
}
