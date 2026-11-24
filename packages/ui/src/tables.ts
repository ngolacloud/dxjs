// @dxjs/ui/tables — an export menu (CSV · XLS · XLSX) and a lightweight tableList.
// The export menu is reused by @dxjs/ui's dataTable; both let you ship a grid your
// users can pull into a spreadsheet. Easy to populate: pass columns + a rows
// accessor. CSP-safe (class-only, safe sinks, no eval).

import { signal } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, type Maybe } from "./base.ts";
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
}

const listCell = <T>(col: ListColumn<T>, row: T): string | number =>
  col.value ? col.value(row) : ((row as Record<string, unknown>)[col.key] as string | number) ?? "";

/** A compact, unpaginated table (the lighter sibling of dataTable) with optional
 *  CSV/XLS/XLSX export. Populate it with `columns` + `rows`. */
export function tableList<T>(o: TableListOptions<T>): TemplateResult {
  const exportCols: ExportColumn<T>[] = o.columns.map((c) => ({ key: c.key, label: c.label, value: c.value }));
  const exp = o.exportable === true ? {} : o.exportable || null;
  const head = o.columns.map((c) => html`<th class=${c.numeric ? "dx-num" : ""}>${c.label}</th>`);
  const row = (r: T): TemplateResult =>
    html`<tr class=${o.onRow ? "is-click" : ""} @click=${o.onRow ? () => o.onRow!(r) : undefined}>${list(
      o.columns,
      (c) => c.key,
      (c) => html`<td class=${c.numeric ? "dx-num" : ""}>${c.render ? c.render(r) : String(listCell(c, r))}</td>`,
    )}</tr>`;
  return html`<section class="dx-card">
    ${o.title || exp || o.toolbar
      ? html`<div class="dx-tbl-toolbar">
          ${o.title ? html`<h2 class="dx-card-title">${o.title}</h2>` : ""}
          <div class="dx-spacer"></div>
          ${o.toolbar ?? ""}
          ${exp ? exportMenu<T>({ rows: () => read(o.rows), columns: exportCols, filename: exp.filename, formats: exp.formats }) : ""}
        </div>`
      : ""}
    <div class="dx-tbl-wrap">
      <table class="dx-tbl" aria-label=${o.title ?? "Data"}>
        <thead><tr>${head}</tr></thead>
        <tbody>${list(() => read(o.rows), (r) => o.rowKey(r), row)}</tbody>
      </table>
    </div>
  </section>`;
}
