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
