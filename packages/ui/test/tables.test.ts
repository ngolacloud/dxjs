import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "@dxjs/dom";
import { tableList, exportMenu, dataTable } from "../src/index.ts";

interface Row { id: string; name: string; mrr: number; }
const rows: Row[] = [
  { id: "a", name: "Acme", mrr: 49 },
  { id: "b", name: "Globex", mrr: 120 },
];

test("tableList renders rows + an export menu that opens with 3 formats", () => {
  const host = body();
  render(
    tableList<Row>({
      title: "Companies",
      columns: [{ key: "name", label: "Company" }, { key: "mrr", label: "MRR", numeric: true, value: (r) => r.mrr }],
      rows,
      rowKey: (r) => r.id,
      exportable: true,
    }),
    host,
  );
  assert.equal(host.querySelectorAll("tbody tr").length, 2);
  const btn = host.querySelector(".dx-export-btn")!;
  const menu = host.querySelector(".dx-export-menu")!;
  assert.ok(menu.hasAttribute("hidden"));
  fire(btn, "click");
  assert.equal(menu.hasAttribute("hidden"), false);
  assert.equal(host.querySelectorAll(".dx-export-item").length, 3, "CSV + XLS + XLSX");
});

test("exportMenu can restrict formats", () => {
  const host = body();
  render(exportMenu<Row>({ rows: () => rows, columns: [{ key: "name", label: "Company" }], formats: ["csv"] }), host);
  fire(host.querySelector(".dx-export-btn")!, "click");
  assert.equal(host.querySelectorAll(".dx-export-item").length, 1);
});

test("tableList sortable column: click reorders rows + flips aria-sort", () => {
  const host = body();
  const unordered: Row[] = [
    { id: "b", name: "Globex", mrr: 120 },
    { id: "a", name: "Acme", mrr: 49 },
  ];
  render(
    tableList<Row>({
      columns: [{ key: "name", label: "Company", sortable: true }, { key: "mrr", label: "MRR", numeric: true, value: (r) => r.mrr }],
      rows: unordered,
      rowKey: (r) => r.id,
    }),
    host,
  );
  const firstName = (): string => host.querySelector("tbody tr td")!.textContent!.trim();
  const nameTh = host.querySelector("thead th") as Element;
  assert.equal(firstName(), "Globex", "unsorted keeps source order");
  assert.equal(nameTh.getAttribute("aria-sort"), "none");

  fire(nameTh, "click");
  assert.equal(firstName(), "Acme", "ascending sort by name");
  assert.equal(nameTh.getAttribute("aria-sort"), "ascending");

  fire(nameTh, "click");
  assert.equal(firstName(), "Globex", "descending sort by name");
  assert.equal(nameTh.getAttribute("aria-sort"), "descending");
});

test("tableList selection: header toggles all + onSelectionChange + is-selected", () => {
  const host = body();
  let last: Array<string | number> = [];
  render(
    tableList<Row>({
      columns: [{ key: "name", label: "Company" }],
      rows,
      rowKey: (r) => r.id,
      selectable: true,
      onSelectionChange: (keys) => { last = keys; },
    }),
    host,
  );
  const head = host.querySelector("thead .dx-tbl-sel input") as HTMLInputElement;
  head.checked = true;
  fire(head, "change");
  assert.deepEqual([...last].sort(), ["a", "b"]);
  assert.equal(host.querySelectorAll("tbody tr.is-selected").length, 2);
});

test("tableList loading renders skeleton rows", () => {
  const host = body();
  render(
    tableList<Row>({ columns: [{ key: "name", label: "Company" }], rows, rowKey: (r) => r.id, loading: true }),
    host,
  );
  assert.ok(host.querySelectorAll("tbody tr.dx-tbl-skel").length > 0);
  assert.ok(host.querySelector(".dx-skel"));
});

test("dataTable gains an export menu when exportable", () => {
  const host = body();
  render(
    dataTable<Row>({
      title: "Accounts",
      columns: [{ key: "name", label: "Company", sortable: true }, { key: "mrr", label: "MRR", numeric: true, value: (r) => r.mrr }],
      rows,
      rowKey: (r) => r.id,
      exportable: { formats: ["csv", "xlsx"] },
    }),
    host,
  );
  assert.ok(host.querySelector(".dx-export-btn"), "export button in the toolbar");
  fire(host.querySelector(".dx-export-btn")!, "click");
  assert.equal(host.querySelectorAll(".dx-export-item").length, 2);
});
