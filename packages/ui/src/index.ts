// @dxjs/ui — a styled, CSP-safe component kit for the NgolaCloud/Seiva console.
//
// Components only toggle CSS CLASSES (the look lives in the served `ui.css`), so
// they run under a strict CSP (`style-src 'self'`, no inline styles). They build
// on @dxjs/dom's safe sinks and @dxjs/core signals — no eval, output escaped,
// deterministic teardown.

import { signal, computed } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, nextId, type Maybe, type Tone } from "./base.ts";
import { exportMenu } from "./tables.ts";
import type { ExportColumn, ExportFormat } from "./export.ts";

export type { Tone, Size, SizeTier, Maybe } from "./base.ts";
export { resolveSize, sizeClass } from "./base.ts";

export { virtualList, visibleRange } from "./virtual.ts";
export type { VirtualListOptions, VisibleRange } from "./virtual.ts";
export { createThemeController, type Theme, type ThemeController } from "./theme.ts";

// New kit modules (base controls, feedback, navigation, rich pickers, sparkline).
export * from "./controls.ts";
export * from "./feedback.ts";
export * from "./nav.ts";
export * from "./pickers.ts";
export * from "./sparkline.ts";
// Advanced suite (export, tables, calendar/holidays, metrics, media, map, rating,
// gantt, planner, Ctrl+K search/filter).
export * from "./export.ts";
export * from "./tables.ts";
export * from "./holidays.ts";
export * from "./calendar.ts";
export * from "./metrics.ts";
export * from "./media.ts";
export * from "./map.ts";
export * from "./rating.ts";
export * from "./gantt.ts";
export * from "./planner.ts";
export * from "./searchfilter.ts";

// --- App shell ------------------------------------------------------------
export interface NavItem {
  label: string;
  active?: boolean;
  onSelect?: () => void;
}
export interface AppShellOptions {
  brand: string;
  nav: Maybe<NavItem[]>;
  user?: { name: string; initials: string };
  search?: { placeholder?: string; onInput?: (value: string) => void };
  /** Extra top-bar content on the left (e.g. a token field). Takes the place of
   *  `search` when no `search` is given. */
  topbar?: Maybe<TemplateResult>;
  content: Maybe<TemplateResult>;
}

/** A dashboard shell: dark sidebar nav + top bar (search/topbar + user) + content. */
export function appShell(o: AppShellOptions): TemplateResult {
  const navItem = (item: NavItem): TemplateResult =>
    html`<button
      class=${item.active ? "dx-nav-item is-active" : "dx-nav-item"}
      aria-current=${item.active ? "page" : false}
      @click=${() => item.onSelect?.()}
    >
      <span class="dx-dot" aria-hidden="true"></span>${item.label}
    </button>`;
  const user = o.user
    ? html`<div class="dx-user"><span class="dx-avatar">${o.user.initials}</span>${o.user.name}</div>`
    : "";
  const left = o.search
    ? html`<div class="dx-search"><input
        placeholder=${o.search.placeholder ?? "Search…"}
        aria-label=${o.search.placeholder ?? "Search"}
        type="search"
        @input=${(e: Event) => o.search!.onInput?.((e.target as HTMLInputElement).value)}
      /></div>`
    : o.topbar
      ? html`${() => read(o.topbar!)}`
      : html`<div class="dx-search"></div>`;
  return html`<div class="dx-shell">
    <aside class="dx-side">
      <div class="dx-brand">${o.brand}</div>
      <nav class="dx-nav" aria-label="Primary">${() => read(o.nav).map(navItem)}</nav>
    </aside>
    <div class="dx-main">
      <header class="dx-top">${left}${user}</header>
      <main class="dx-content">${() => read(o.content)}</main>
    </div>
  </div>`;
}

// --- Stat cards -----------------------------------------------------------
export interface StatCardOptions {
  label: string;
  value: Maybe<string>;
  delta?: Maybe<string>;
  tone?: Tone;
}

/** A single KPI tile. */
export function statCard(o: StatCardOptions): TemplateResult {
  const tone = `dx-stat-delta is-${o.tone ?? "mut"}`;
  return html`<div class="dx-stat">
    <div class="dx-stat-label">${o.label}</div>
    <div class="dx-stat-value">${() => read(o.value)}</div>
    ${o.delta ? html`<div class=${tone}>${() => read(o.delta!)}</div>` : ""}
  </div>`;
}

/** A responsive grid of stat cards. */
export function statGrid(cards: StatCardOptions[]): TemplateResult {
  return html`<div class="dx-stats">${list(cards, (c) => c.label, statCard)}</div>`;
}

// --- Card -----------------------------------------------------------------
export function card(o: { title?: string; body: Maybe<TemplateResult> }): TemplateResult {
  const titleId = o.title ? nextId("dx-card") : "";
  return html`<section class="dx-card" aria-labelledby=${titleId || false}>
    ${o.title ? html`<div class="dx-card-head"><h2 class="dx-card-title" id=${titleId}>${o.title}</h2></div>` : ""}
    <div class="dx-card-body">${() => read(o.body)}</div>
  </section>`;
}

/** A status pill. */
export function pill(label: string, tone: Tone = "mut"): TemplateResult {
  return html`<span class=${`dx-pill is-${tone}`}>${label}</span>`;
}

// --- Data table -----------------------------------------------------------
export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  numeric?: boolean;
  /** Sort/filter/display value (defaults to `row[key]`). */
  value?: (row: T) => string | number;
  /** Custom cell content (defaults to the string value). */
  render?: (row: T) => TemplateResult | string;
}
export interface DataTableOptions<T> {
  columns: Column<T>[];
  rows: Maybe<T[]>;
  rowKey: (row: T) => string | number;
  title?: string;
  search?: boolean;
  pageSize?: number;
  /** Add a CSV/XLS/XLSX export menu that exports the current (filtered+sorted) view. */
  exportable?: boolean | { filename?: string; formats?: ExportFormat[] };
  /** Extra toolbar content, e.g. an Export button. */
  toolbar?: TemplateResult;
}

const cellValue = <T,>(col: Column<T>, row: T): string | number =>
  col.value ? col.value(row) : ((row as Record<string, unknown>)[col.key] as string | number) ?? "";

/** A sortable, searchable, paginated data table (keyed rows). */
export function dataTable<T>(o: DataTableOptions<T>): TemplateResult {
  const query = signal("");
  const sortKey = signal<string | null>(null);
  const sortDesc = signal(false);
  const page = signal(0);
  const pageSize = o.pageSize ?? 10;

  const filtered = computed(() => {
    const q = query().trim().toLowerCase();
    const rows = read(o.rows);
    if (!q) return rows;
    return rows.filter((r) => o.columns.some((c) => String(cellValue(c, r)).toLowerCase().includes(q)));
  });
  const sorted = computed(() => {
    const key = sortKey();
    const rows = filtered();
    if (!key) return rows;
    const col = o.columns.find((c) => c.key === key);
    if (!col) return rows;
    const dir = sortDesc() ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = cellValue(col, a);
      const bv = cellValue(col, b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  });
  const total = computed(() => sorted().length);
  const pageCount = computed(() => Math.max(1, Math.ceil(total() / pageSize)));
  const paged = computed(() => {
    const p = Math.min(page(), pageCount() - 1);
    return sorted().slice(p * pageSize, p * pageSize + pageSize);
  });

  const toggleSort = (col: Column<T>): void => {
    if (!col.sortable) return;
    if (sortKey() === col.key) sortDesc.set(!sortDesc());
    else {
      sortKey.set(col.key);
      sortDesc.set(false);
    }
    page.set(0);
  };

  const header = (col: Column<T>): TemplateResult => {
    const cls = col.sortable ? "is-sortable" : "";
    const arrow = (): string => (sortKey() === col.key ? (sortDesc() ? "▼" : "▲") : "");
    // aria-sort reflects the live sort state for THIS column (only on sortable
    // headers, per ARIA). Keyboard: a sortable header is focusable and Enter/Space
    // toggles the sort — not just a mouse `@click` on a non-focusable <th>.
    const ariaSort = (): string | false =>
      col.sortable ? (sortKey() === col.key ? (sortDesc() ? "descending" : "ascending") : "none") : false;
    const onKey = (e: KeyboardEvent): void => {
      if (col.sortable && (e.key === "Enter" || e.key === " ")) {
        e.preventDefault();
        toggleSort(col);
      }
    };
    return html`<th
      class=${cls}
      aria-sort=${ariaSort}
      tabindex=${col.sortable ? "0" : false}
      @click=${() => toggleSort(col)}
      @keydown=${onKey}
    >${col.label}<span class="dx-arrow" aria-hidden="true">${arrow}</span></th>`;
  };

  const row = (r: T): TemplateResult =>
    html`<tr>${list(
      o.columns,
      (c) => c.key,
      (c) => html`<td class=${c.numeric ? "dx-num" : ""}>${c.render ? c.render(r) : String(cellValue(c, r))}</td>`,
    )}</tr>`;

  const from = (): number => (total() === 0 ? 0 : Math.min(page(), pageCount() - 1) * pageSize + 1);
  const to = (): number => Math.min(from() + pageSize - 1, total());

  return html`<section class="dx-card">
    ${o.title ? html`<div class="dx-card-head"><h2 class="dx-card-title">${o.title}</h2></div>` : ""}
    <div class="dx-tbl-toolbar">
      ${o.search === false
        ? ""
        : html`<div class="dx-tbl-search"><input
            placeholder="Search…"
            aria-label=${o.title ? `Search ${o.title}` : "Search records"}
            type="search"
            @input=${(e: Event) => {
              query.set((e.target as HTMLInputElement).value);
              page.set(0);
            }}
          /></div>`}
      <div class="dx-spacer"></div>
      ${o.toolbar ?? ""}
      ${o.exportable
        ? exportMenu<T>({
            rows: () => sorted(),
            columns: o.columns.map((c) => ({ key: c.key, label: c.label, value: c.value }) as ExportColumn<T>),
            filename: (o.exportable === true ? undefined : o.exportable.filename) ?? (o.title ? o.title.toLowerCase().replace(/\s+/g, "-") : "export"),
            formats: o.exportable === true ? undefined : o.exportable.formats,
          })
        : ""}
    </div>
    <div class="dx-tbl-wrap">
      <table class="dx-tbl" aria-label=${o.title ?? "Data table"}>
        <thead><tr>${list(o.columns, (c) => c.key, header)}</tr></thead>
        <tbody>${list(() => paged(), (r) => o.rowKey(r), row)}</tbody>
      </table>
    </div>
    ${() => (total() === 0 ? html`<div class="dx-tbl-empty" role="status">No records match your filter.</div>` : "")}
    <div class="dx-tbl-foot">
      <span aria-live="polite">Showing ${from} – ${to} of ${total}</span>
      <div class="dx-spacer"></div>
      <button class="dx-btn" aria-label="Previous page" ?disabled=${() => page() <= 0} @click=${() => page.set(Math.max(0, page() - 1))}>‹ Prev</button>
      <span>Page ${() => Math.min(page(), pageCount() - 1) + 1} / ${pageCount}</span>
      <button class="dx-btn" aria-label="Next page" ?disabled=${() => page() >= pageCount() - 1} @click=${() => page.set(Math.min(pageCount() - 1, page() + 1))}>Next ›</button>
    </div>
  </section>`;
}
