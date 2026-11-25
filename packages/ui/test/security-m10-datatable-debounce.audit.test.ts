// AUDIT PoC — M10: dataTable search is a client-side DoS (A05-ish).
//   Before the fix, the search <input>'s @input set `query` on every keystroke,
//   re-running the O(n·m) `filtered`→`sorted`→`paged` chain SYNCHRONOUSLY per key.
//   On a large table this janks/locks the main thread while typing. The fix
//   debounces the search: a keystroke no longer filters on the input event, and a
//   burst coalesces into ONE filter pass. These tests assert the SAFE behaviour
//   (red pre-fix: the table filters immediately on the first keystroke).
// Run with --test-force-exit: a debounce timer may still be pending at test end.
import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "@dxjs/dom";
import { dataTable } from "../src/index.ts";

interface Row {
  id: string;
  name: string;
}
const rows: Row[] = [
  { id: "a", name: "Acme" },
  { id: "b", name: "Globex" },
  { id: "c", name: "Initech" },
];
const cols = [{ key: "name", label: "Company" }];
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const bodyRows = (host: Element): number =>
  host.querySelectorAll("tbody tr:not(.dx-tbl-empty):not(.dx-tbl-skel)").length;
const typeInto = (input: HTMLInputElement, value: string): void => {
  input.value = value;
  fire(input, "input");
};

test("M10: a keystroke does NOT filter synchronously (debounce defers it)", async () => {
  const host = body();
  render(dataTable<Row>({ columns: cols, rows, rowKey: (r) => r.id, debounce: 30 }), host);
  assert.equal(bodyRows(host), 3, "all rows shown initially");

  const input = host.querySelector(".dx-tbl-search input") as HTMLInputElement;
  typeInto(input, "Acme");
  // Pre-fix this is already 1 (filtered on the keystroke). With debounce it is
  // still 3 — the expensive filter has NOT run on the input event.
  assert.equal(bodyRows(host), 3, "filter is deferred off the keystroke path");

  await sleep(50);
  assert.equal(bodyRows(host), 1, "after the debounce window the filter applied once");
  assert.equal((host.querySelector("tbody tr td") as Element).textContent, "Acme");
});

test("M10: a burst of keystrokes coalesces into a single applied query", async () => {
  const host = body();
  render(dataTable<Row>({ columns: cols, rows, rowKey: (r) => r.id, debounce: 30 }), host);
  const input = host.querySelector(".dx-tbl-search input") as HTMLInputElement;

  // Type "I", "In", "Ini", "Init"… rapidly within one window.
  for (const v of ["I", "In", "Ini", "Init", "Initech"]) typeInto(input, v);
  assert.equal(bodyRows(host), 3, "no intermediate value filtered mid-burst");

  await sleep(50);
  assert.equal(bodyRows(host), 1, "only the final value is applied, once");
  assert.equal((host.querySelector("tbody tr td") as Element).textContent, "Initech");
});

test("M10: debounce:0 preserves immediate filtering (escape hatch)", () => {
  const host = body();
  render(dataTable<Row>({ columns: cols, rows, rowKey: (r) => r.id, debounce: 0 }), host);
  const input = host.querySelector(".dx-tbl-search input") as HTMLInputElement;
  typeInto(input, "Globex");
  assert.equal(bodyRows(host), 1, "debounce:0 filters synchronously on the keystroke");
  assert.equal((host.querySelector("tbody tr td") as Element).textContent, "Globex");
});
