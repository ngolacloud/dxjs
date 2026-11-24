import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "@dxjs/dom";
import { dataTable } from "../src/index.ts";

interface Row { id: string; name: string; mrr: number; }
const rows: Row[] = [
  { id: "a", name: "Acme", mrr: 49 },
  { id: "b", name: "Globex", mrr: 120 },
];

const cols = [
  { key: "name", label: "Company", sortable: true },
  { key: "mrr", label: "MRR", numeric: true, align: "center" as const, value: (r: Row) => r.mrr },
];

test("dataTable selection: header toggles all, onSelectionChange fires, is-selected class", () => {
  const host = body();
  let last: Array<string | number> = [];
  render(
    dataTable<Row>({
      columns: cols,
      rows,
      rowKey: (r) => r.id,
      selectable: true,
      onSelectionChange: (keys) => { last = keys; },
    }),
    host,
  );
  // A leading selection column exists in the header + each body row.
  assert.ok(host.querySelector("thead .dx-tbl-sel input"), "header checkbox present");
  assert.equal(host.querySelectorAll("tbody .dx-tbl-sel input").length, 2);

  const head = host.querySelector("thead .dx-tbl-sel input") as HTMLInputElement;
  head.checked = true;
  fire(head, "change");
  assert.deepEqual([...last].sort(), ["a", "b"], "selecting all fires every key");
  assert.equal(host.querySelectorAll("tbody tr.is-selected").length, 2, "both rows marked selected");

  head.checked = false;
  fire(head, "change");
  assert.deepEqual(last, [], "deselecting all clears the keys");
  assert.equal(host.querySelectorAll("tbody tr.is-selected").length, 0);

  // Selecting a single row reports just that key.
  const first = host.querySelector("tbody .dx-tbl-sel input") as HTMLInputElement;
  first.checked = true;
  fire(first, "change");
  assert.deepEqual(last, ["a"]);
  assert.equal(host.querySelectorAll("tbody tr.is-selected").length, 1);
});

test("dataTable onRow: clicking a row invokes the callback", () => {
  const host = body();
  let clicked: Row | null = null;
  render(
    dataTable<Row>({ columns: cols, rows, rowKey: (r) => r.id, onRow: (r) => { clicked = r; } }),
    host,
  );
  const tr = host.querySelector("tbody tr") as Element;
  assert.ok(tr.classList.contains("is-click"), "row carries the clickable class");
  assert.equal(tr.getAttribute("tabindex"), "0");
  fire(tr, "click");
  assert.equal((clicked as Row | null)?.id, "a");
});

test("dataTable loading: shows skeleton rows (no empty state), keeps header", () => {
  const host = body();
  render(
    dataTable<Row>({ columns: cols, rows: [], rowKey: (r) => r.id, loading: true }),
    host,
  );
  assert.ok(host.querySelectorAll("tbody tr.dx-tbl-skel").length > 0, "skeleton rows rendered");
  assert.ok(host.querySelector(".dx-skel"), "skeleton shimmer lines present");
  assert.equal(host.querySelector(".dx-tbl-empty"), null, "no empty state while loading");
  assert.equal(host.querySelectorAll("thead th").length, 2, "header stays visible");
});

test("dataTable alignment classes land on th + td", () => {
  const host = body();
  render(dataTable<Row>({ columns: cols, rows, rowKey: (r) => r.id }), host);
  const ths = host.querySelectorAll("thead th");
  assert.ok((ths[1] as Element).classList.contains("dx-ta-center"), "explicit align on header");
  const td = host.querySelector("tbody tr td:nth-child(2)") as Element;
  assert.ok(td.classList.contains("dx-ta-center"), "explicit align on cell");
  assert.ok(td.classList.contains("dx-num"), "numeric class retained");
});

test("dataTable density + striped + sticky modifier classes on the table", () => {
  const host = body();
  render(
    dataTable<Row>({ columns: cols, rows, rowKey: (r) => r.id, density: "compact", striped: true, stickyHeader: true }),
    host,
  );
  const table = host.querySelector("table.dx-tbl") as Element;
  assert.ok(table.classList.contains("is-compact"));
  assert.ok(table.classList.contains("is-striped"));
  assert.ok(table.classList.contains("is-sticky"));
});
