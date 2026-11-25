// @dxjs/ui/export — table export to CSV, .xls (SpreadsheetML/HTML) and REAL .xlsx
// (minimal OOXML, self-contained, zero dependencies). CSP-safe: pure data in, bytes
// out; `download()` uses a Blob object URL + a programmatic anchor click (no eval,
// no inline). The .xlsx writer builds a STORE (uncompressed) zip with correct
// CRC-32s, so LibreOffice/Excel open it as a native workbook.

export interface ExportColumn<T> {
  key: string;
  label: string;
  /** Cell value (defaults to row[key]). */
  value?: (row: T) => string | number;
}
export type ExportFormat = "csv" | "xls" | "xlsx";

const cellOf = <T>(col: ExportColumn<T>, row: T): string | number => {
  if (col.value) return col.value(row);
  const v = (row as Record<string, unknown>)[col.key];
  return (v as string | number) ?? "";
};
const isNum = (v: string | number): v is number => typeof v === "number" && Number.isFinite(v);

// --- CSV (RFC 4180) --------------------------------------------------------
// A leading = + - @ TAB or CR makes Excel/LibreOffice/Sheets treat the cell as a
// formula/DDE (CWE-1236: CSV formula injection). Quoting does NOT help — Excel
// evaluates "=..." all the same — so we prefix the value with an apostrophe, which
// those apps render literally. Applied before RFC-4180 quoting.
const FORMULA_TRIGGER = /^[=+\-@\t\r]/;
const csvField = (v: string | number): string => {
  let s = String(v);
  if (FORMULA_TRIGGER.test(s)) s = "'" + s;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
export function toCsv<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const head = columns.map((c) => csvField(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => csvField(cellOf(c, r))).join(",")).join("\r\n");
  return body ? `${head}\r\n${body}` : head;
}

// --- XML escaping (shared by .xls and .xlsx) -------------------------------
const xml = (v: string | number): string =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

// --- .xls (SpreadsheetML as an HTML table — Excel/LibreOffice open it) ------
export function toXls<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const th = columns.map((c) => `<th>${xml(c.label)}</th>`).join("");
  const trs = rows
    .map((r) => `<tr>${columns.map((c) => {
      const v = cellOf(c, r);
      return isNum(v) ? `<td style="mso-number-format:General">${xml(v)}</td>` : `<td>${xml(v)}</td>`;
    }).join("")}</tr>`)
    .join("");
  // The xmlns + meta make Excel/LibreOffice treat the HTML as a worksheet.
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"/><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Sheet1</x:Name></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table border="1"><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table></body></html>`;
}

// --- .xlsx (real OOXML, minimal) -------------------------------------------
const enc = new TextEncoder();

/** Column index (0-based) → spreadsheet letter(s): 0→A, 25→Z, 26→AA. */
export function colLetter(i: number): string {
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

function sheetXml<T>(rows: T[], columns: ExportColumn<T>[]): string {
  const cell = (ci: number, ri: number, v: string | number): string => {
    const ref = `${colLetter(ci)}${ri}`;
    if (isNum(v)) return `<c r="${ref}"><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(v)}</t></is></c>`;
  };
  const headRow = `<row r="1">${columns.map((c, ci) => cell(ci, 1, c.label)).join("")}</row>`;
  const bodyRows = rows
    .map((r, i) => `<row r="${i + 2}">${columns.map((c, ci) => cell(ci, i + 2, cellOf(c, r))).join("")}</row>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${headRow}${bodyRows}</sheetData></worksheet>`;
}

// CRC-32 (IEEE), table built once.
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

interface ZipEntry { name: string; data: Uint8Array; crc: number; offset: number; }

/** A minimal STORE (uncompressed) zip. Correct CRC-32s + offsets → a valid OOXML. */
function zipStore(files: Array<{ name: string; data: Uint8Array }>): Uint8Array {
  const chunks: Uint8Array[] = [];
  const entries: ZipEntry[] = [];
  let offset = 0;
  const u16 = (n: number): Uint8Array => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
  const u32 = (n: number): Uint8Array => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
  const push = (b: Uint8Array): void => {
    chunks.push(b);
    offset += b.length;
  };

  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = crc32(f.data);
    entries.push({ name: f.name, data: f.data, crc, offset });
    // local file header
    push(u32(0x04034b50));
    push(u16(20)); // version needed
    push(u16(0)); // flags
    push(u16(0)); // method = store
    push(u16(0)); // mod time
    push(u16(0)); // mod date
    push(u32(crc));
    push(u32(f.data.length)); // compressed size
    push(u32(f.data.length)); // uncompressed size
    push(u16(name.length));
    push(u16(0)); // extra len
    push(name);
    push(f.data);
  }

  const cdStart = offset;
  for (const e of entries) {
    const name = enc.encode(e.name);
    push(u32(0x02014b50));
    push(u16(20)); // version made by
    push(u16(20)); // version needed
    push(u16(0)); // flags
    push(u16(0)); // method
    push(u16(0)); // mod time
    push(u16(0)); // mod date
    push(u32(e.crc));
    push(u32(e.data.length));
    push(u32(e.data.length));
    push(u16(name.length));
    push(u16(0)); // extra
    push(u16(0)); // comment
    push(u16(0)); // disk start
    push(u16(0)); // internal attrs
    push(u32(0)); // external attrs
    push(u32(e.offset)); // local header offset
    push(name);
  }
  const cdSize = offset - cdStart;

  // end of central directory
  push(u32(0x06054b50));
  push(u16(0)); // disk
  push(u16(0)); // cd disk
  push(u16(entries.length));
  push(u16(entries.length));
  push(u32(cdSize));
  push(u32(cdStart));
  push(u16(0)); // comment len

  const total = chunks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of chunks) {
    out.set(b, p);
    p += b.length;
  }
  return out;
}

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`;
const ROOT_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
const WORKBOOK =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`;
const WORKBOOK_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`;

/** A real .xlsx workbook (one sheet) as bytes. */
export function toXlsx<T>(rows: T[], columns: ExportColumn<T>[]): Uint8Array {
  return zipStore([
    { name: "[Content_Types].xml", data: enc.encode(CONTENT_TYPES) },
    { name: "_rels/.rels", data: enc.encode(ROOT_RELS) },
    { name: "xl/workbook.xml", data: enc.encode(WORKBOOK) },
    { name: "xl/_rels/workbook.xml.rels", data: enc.encode(WORKBOOK_RELS) },
    { name: "xl/worksheets/sheet1.xml", data: enc.encode(sheetXml(rows, columns)) },
  ]);
}

// --- Browser download ------------------------------------------------------
const MIME: Record<ExportFormat, string> = {
  csv: "text/csv;charset=utf-8",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/** Trigger a file download in the browser (Blob URL + anchor click; CSP-safe). */
export function download(filename: string, data: string | Uint8Array, mime: string): void {
  const doc = (globalThis as { document?: Document }).document;
  const URLc = (globalThis as { URL?: typeof URL }).URL;
  if (!doc || !URLc) return;
  const blob = new Blob([data as BlobPart], { type: mime });
  const url = URLc.createObjectURL(blob);
  const a = doc.createElement("a");
  a.href = url;
  a.download = filename;
  doc.body.appendChild(a);
  a.click();
  a.remove();
  URLc.revokeObjectURL(url);
}

/** Export rows to a file in the chosen format (browser). */
export function exportTable<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  format: ExportFormat,
  filename = "export",
): void {
  if (format === "csv") return download(`${filename}.csv`, toCsv(rows, columns), MIME.csv);
  if (format === "xls") return download(`${filename}.xls`, toXls(rows, columns), MIME.xls);
  return download(`${filename}.xlsx`, toXlsx(rows, columns), MIME.xlsx);
}
