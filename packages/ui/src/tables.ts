// @dxjs/ui/tables — an export menu (CSV · XLS · XLSX) and a lightweight tableList.
// The export menu is reused by @dxjs/ui's dataTable; both let you ship a grid your
// users can pull into a spreadsheet. Easy to populate: pass columns + a rows
// accessor. CSP-safe (class-only, safe sinks, no eval).

import { signal, computed } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, type Maybe } from "./base.ts";
import { checkbox } from "./controls.ts";
import { exportTable, type ExportColumn, type ExportFormat } from "./export.ts";

const FORMAT_LABELS: Record<ExportFormat, string> = { csv: "CSV", xls: "Excel (.xls)", xlsx: "Excel (.xlsx)" };

export interface ExportMenuOptions<T> {
  /** The rows to export (an accessor so it reflects the live/filtered view). */
  rows: () => T[];
  columns: ExportColumn<T>[];
  filename?: string;
  /** Which formats to offer (default all three). */
  formats?: ExportFormat[];
  label?: string;
}

/** A dropdown button that exports the current rows to CSV / XLS / XLSX. */
export function exportMenu<T>(o: ExportMenuOptions<T>): TemplateResult {
  const open = signal(false);
  const formats = o.formats ?? (["csv", "xls", "xlsx"] as ExportFormat[]);
  const run = (fmt: ExportFormat): void => {
    exportTable(o.rows(), o.columns, fmt, o.filename ?? "export");
    open.set(false);
  };
  return html`<div
    class="dx-export"
    @focusout=${(e: FocusEvent) => {
      const root = e.currentTarget as HTMLElement;
      const next = e.relatedTarget as Node | null;
      if (!next || !root.contains(next)) open.set(false);
    }}
  >
    <button class="dx-btn dx-export-btn" type="button" aria-haspopup="menu" aria-expanded=${() => (open() ? "true" : "false")} @click=${() => open.set(!open())}>
      <span class="dx-export-ico" aria-hidden="true">⤓</span>${o.label ?? "Export"}<span class="dx-s2-caret" aria-hidden="true">▾</span>
    </button>
    <div class="dx-export-menu" role="menu" ?hidden=${() => !open()}>${formats.map(
      (f) => html`<button class="dx-export-item" role="menuitem" type="button" @click=${() => run(f)}>${FORMAT_LABELS[f]}</button>`,
    )}</div>
  </div>`;
}

// --- tableList -------------------------------------------------------------
export interface ListColumn<T> {
  key: string;
  label: string;
  numeric?: boolean;
  /** Click-to-sort this column (aria-sort + keyboard Enter/Space). */
  sortable?: boolean;
  /** Cell alignment. `numeric` implies "right" unless overridden here. */
  align?: "left" | "center" | "right";
  value?: (row: T) => string | number;
  render?: (row: T) => TemplateResult | string;
}
export interface TableListOptions<T> {
  columns: ListColumn<T>[];
  rows: Maybe<T[]>;
  rowKey: (row: T) => string | number;
  title?: string;
  /** Add an export toolbar (CSV/XLS/XLSX). */
  exportable?: boolean | { filename?: string; formats?: ExportFormat[] };
  /** Extra toolbar content. */
  toolbar?: TemplateResult;
  onRow?: (row: T) => void;
  /** Leading checkbox column; the header checkbox toggles every row. */
  selectable?: boolean;
  /** Fires with the selected `rowKey`s whenever the selection changes. */
  onSelectionChange?: (keys: Array<string | number>) => void;
  /** While true, render skeleton rows instead of the body. */
  loading?: Maybe<boolean>;
  /** Row padding: "comfortable" (default) or "compact". */
  density?: "compact" | "comfortable";
  /** Zebra-stripe body rows. */
  striped?: boolean;
  /** Keep the header visible while the body scrolls inside `.dx-tbl-wrap`. */
  stickyHeader?: boolean;
}

const listCell = <T>(col: ListColumn<T>, row: T): string | number =>
  col.value ? col.value(row) : ((row as Record<string, unknown>)[col.key] as string | number) ?? "";

/** Alignment class for a list column (numeric ⇒ right unless `align` set). */
const listAlign = <T>(col: ListColumn<T>): string => {
  const a = col.align ?? (col.numeric ? "right" : null);
  return a ? `dx-ta-${a}` : "";
};

/** A compact, unpaginated table (the lighter sibling of dataTable) with optional
 *  CSV/XLS/XLSX export, click-to-sort, selection and skeleton loading.
 *
 * Minimal call — just `columns`, `rows`, `rowKey`:
 * ```ts
 * tableList({
 *   columns: [{ key: "name", label: "Name" }, { key: "mrr", label: "MRR", numeric: true }],
 *   rows: companies,
 *   rowKey: (r) => r.id,
 * });
 * ``` */
export function tableList<T>(o: TableListOptions<T>): TemplateResult {
  const exportCols: ExportColumn<T>[] = o.columns.map((c) => ({ key: c.key, label: c.label, value: c.value }));
  const exp = o.exportable === true ? {} : o.exportable || null;

  const sortKey = signal<string | null>(null);
  const sortDesc = signal(false);
  const sorted = computed(() => {
    const key = sortKey();
    const rows = read(o.rows);
    if (!key) return rows;
    const col = o.columns.find((c) => c.key === key);
    if (!col) return rows;
    const dir = sortDesc() ? -1 : 1;
    return [...rows].sort((a, b) => {
      const av = listCell(col, a);
      const bv = listCell(col, b);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  });
  const toggleSort = (col: ListColumn<T>): void => {
    if (!col.sortable) return;
    if (sortKey() === col.key) sortDesc.set(!sortDesc());
    else {
      sortKey.set(col.key);
      sortDesc.set(false);
    }
  };

  // --- selection (keyed by rowKey; header toggles every row) --------------
  const sel = signal<Set<string | number>>(new Set());
  const emit = (next: Set<string | number>): void => {
    sel.set(next);
    o.onSelectionChange?.([...next]);
  };
  const setSel = (key: string | number, on: boolean): void => {
    const next = new Set(sel());
    if (on) next.add(key);
    else next.delete(key);
    emit(next);
  };
  const allKeys = (): Array<string | number> => read(o.rows).map((r) => o.rowKey(r));
  const allChecked = (): boolean => {
    const ks = allKeys();
    return ks.length > 0 && ks.every((k) => sel().has(k));
  };
  const toggleAll = (on: boolean): void => {
    const next = new Set(sel());
    for (const k of allKeys()) if (on) next.add(k); else next.delete(k);
    emit(next);
  };

  const header = (col: ListColumn<T>): TemplateResult => {
    const cls = cx(col.sortable && "is-sortable", col.numeric && "dx-num", listAlign(col));
    const arrow = (): string => (sortKey() === col.key ? (sortDesc() ? "▼" : "▲") : "");
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

  const row = (r: T): TemplateResult => {
    const key = o.rowKey(r);
    const onKey = o.onRow
      ? (e: KeyboardEvent): void => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            o.onRow!(r);
          }
        }
      : undefined;
    return html`<tr
      class=${() => cx(o.selectable && sel().has(key) && "is-selected", o.onRow && "is-click")}
      tabindex=${o.onRow ? "0" : false}
      @click=${o.onRow ? () => o.onRow!(r) : undefined}
      @keydown=${onKey}
    >${o.selectable
        ? html`<td class="dx-tbl-sel" @click=${(e: Event) => e.stopPropagation()}>${checkbox({
            checked: () => sel().has(key),
            onChange: (on) => setSel(key, on),
          })}</td>`
        : ""}${list(
        o.columns,
        (c) => c.key,
        (c) => html`<td class=${cx(c.numeric && "dx-num", listAlign(c))}>${c.render ? c.render(r) : String(listCell(c, r))}</td>`,
      )}</tr>`;
  };

  const colCount = (): number => o.columns.length + (o.selectable ? 1 : 0);
  const skeletonBody = (): TemplateResult => {
    const skelRow = (): TemplateResult =>
      html`<tr class="dx-tbl-skel" aria-hidden="true">${Array.from(
        { length: colCount() },
        () => html`<td><span class="dx-skel dx-skel-line"></span></td>`,
      )}</tr>`;
    return html`${Array.from({ length: 4 }, skelRow)}`;
  };
  const isLoading = (): boolean => read(o.loading ?? false);

  return html`<section class="dx-card">
    ${o.title || exp || o.toolbar
      ? html`<div class="dx-tbl-toolbar">
          ${o.title ? html`<h2 class="dx-card-title">${o.title}</h2>` : ""}
          <div class="dx-spacer"></div>
          ${o.toolbar ?? ""}
          ${exp ? exportMenu<T>({ rows: () => sorted(), columns: exportCols, filename: exp.filename, formats: exp.formats }) : ""}
        </div>`
      : ""}
    <div class="dx-tbl-wrap">
      <table class=${cx("dx-tbl", o.density === "compact" && "is-compact", o.striped && "is-striped", o.stickyHeader && "is-sticky")} aria-label=${o.title ?? "Data"}>
        <thead><tr>${o.selectable
          ? html`<th class="dx-tbl-sel">${checkbox({ checked: () => allChecked(), onChange: (on) => toggleAll(on) })}</th>`
          : ""}${list(o.columns, (c) => c.key, header)}</tr></thead>
        <tbody>${() => (isLoading() ? skeletonBody() : "")}${list(() => (isLoading() ? [] : sorted()), (r) => o.rowKey(r), row)}</tbody>
      </table>
    </div>
  </section>`;
}
