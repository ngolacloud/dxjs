import { test } from "node:test";
import assert from "node:assert/strict";
import { toCsv, toXls, toXlsx, colLetter, type ExportColumn } from "../src/export.ts";

interface Row { name: string; mrr: number; note: string; }
const columns: ExportColumn<Row>[] = [
  { key: "name", label: "Company" },
  { key: "mrr", label: "MRR", value: (r) => r.mrr },
  { key: "note", label: "Note" },
];
const rows: Row[] = [
  { name: "Acme", mrr: 49, note: "ok" },
  { name: 'Globex, "Inc"', mrr: 120, note: "line1\nline2" }, // needs CSV quoting
];

test("toCsv quotes commas, quotes and newlines (RFC 4180)", () => {
  const csv = toCsv(rows, columns);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], "Company,MRR,Note");
  assert.equal(lines[1], "Acme,49,ok");
  // Globex field has comma+quotes → wrapped and quotes doubled; note has newline → wrapped.
  assert.ok(lines[2]!.startsWith('"Globex, ""Inc""",120,"line1'), lines[2]);
  assert.ok(csv.includes('"line1\nline2"'));
});

test("toXls emits an HTML/SpreadsheetML table Excel opens", () => {
  const x = toXls(rows, columns);
  assert.ok(x.includes("<x:Name>Sheet1</x:Name>"));
  assert.ok(x.includes("<th>Company</th>"));
  assert.ok(x.includes("<td>Acme</td>"));
  assert.ok(x.includes("Globex, &quot;Inc&quot;"), "xml-escaped");
});

test("colLetter maps 0→A, 25→Z, 26→AA, 27→AB", () => {
  assert.equal(colLetter(0), "A");
  assert.equal(colLetter(25), "Z");
  assert.equal(colLetter(26), "AA");
  assert.equal(colLetter(27), "AB");
});

// --- A tiny STORE-zip reader to prove the .xlsx is a valid archive --------
function readZip(buf: Uint8Array): Map<string, Uint8Array> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // locate EOCD (0x06054b50) from the end (no zip comment, so it's at len-22).
  let eocd = buf.length - 22;
  while (eocd >= 0 && dv.getUint32(eocd, true) !== 0x06054b50) eocd--;
  assert.ok(eocd >= 0, "EOCD found");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true); // central dir offset
  const out = new Map<string, Uint8Array>();
  const td = new TextDecoder();
  for (let i = 0; i < count; i++) {
    assert.equal(dv.getUint32(p, true), 0x02014b50, "central dir signature");
    const crc = dv.getUint32(p + 16, true);
    const size = dv.getUint32(p + 24, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const cmtLen = dv.getUint16(p + 32, true);
    const lho = dv.getUint32(p + 42, true);
    const name = td.decode(buf.subarray(p + 46, p + 46 + nameLen));
    // local header → data
    assert.equal(dv.getUint32(lho, true), 0x04034b50, "local signature");
    const lNameLen = dv.getUint16(lho + 26, true);
    const lExtraLen = dv.getUint16(lho + 28, true);
    const dataStart = lho + 30 + lNameLen + lExtraLen;
    const data = buf.subarray(dataStart, dataStart + size);
    // verify CRC-32 of the stored bytes matches the directory
    let c = 0xffffffff;
    for (let k = 0; k < data.length; k++) {
      c ^= data[k]!;
      for (let b = 0; b < 8; b++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    assert.equal((~c >>> 0) >>> 0, crc, `CRC-32 for ${name}`);
    out.set(name, data);
    p += 46 + nameLen + extraLen + cmtLen;
  }
  return out;
}

test("toXlsx produces a valid zip with correct CRCs and the expected cells", () => {
  const bytes = toXlsx(rows, columns);
  // PK signature
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const parts = readZip(bytes);
  for (const name of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/worksheets/sheet1.xml"]) {
    assert.ok(parts.has(name), `part ${name} present`);
  }
  const sheet = new TextDecoder().decode(parts.get("xl/worksheets/sheet1.xml")!);
  assert.ok(sheet.includes('<c r="A1" t="inlineStr"><is><t xml:space="preserve">Company</t></is></c>'), "header cell A1");
  assert.ok(sheet.includes("<c r=\"B2\"><v>49</v></c>"), "numeric cell B2 = 49");
  assert.ok(sheet.includes("Globex, &quot;Inc&quot;"), "escaped string cell");
  assert.ok(sheet.includes('<c r="A3"'), "second data row present");
});
