import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html, render } from "@dxjs/dom";
import { appShell, card, dataTable } from "../src/index.ts";

interface Row {
  id: string;
  name: string;
  mrr: number;
}
const rows: Row[] = [
  { id: "a", name: "Alpha", mrr: 30 },
  { id: "b", name: "Bravo", mrr: 10 },
  { id: "c", name: "Charlie", mrr: 20 },
];

test("appShell nav exposes aria-label and aria-current on the active item", () => {
  const host = body();
  const active = signal("a");
  render(
    appShell({
      brand: "X",
      nav: () => [
        { label: "Alpha", active: active() === "a", onSelect: () => active.set("a") },
        { label: "Beta", active: active() === "b", onSelect: () => active.set("b") },
      ],
      search: { placeholder: "Find things" },
      content: html`<p>c</p>`,
    }),
    host,
  );
  assert.equal(host.querySelector("nav.dx-nav")!.getAttribute("aria-label"), "Primary");
  const find = (t: string) => [...host.querySelectorAll(".dx-nav-item")].find((b) => b.textContent!.includes(t))!;
  assert.equal(find("Alpha").getAttribute("aria-current"), "page", "active item is aria-current=page");
  assert.equal(find("Beta").getAttribute("aria-current"), null, "inactive item has no aria-current");

  // Reactive: aria-current moves with the selection.
  active.set("b");
  assert.equal(find("Beta").getAttribute("aria-current"), "page");
  assert.equal(find("Alpha").getAttribute("aria-current"), null);

  // The search input has an accessible name.
  assert.equal(host.querySelector(".dx-search input")!.getAttribute("aria-label"), "Find things");
  // Decorative dots are hidden from the a11y tree.
  assert.equal(host.querySelector(".dx-dot")!.getAttribute("aria-hidden"), "true");
});

test("card is named via aria-labelledby → its heading id", () => {
  const host = body();
  render(card({ title: "Usage", body: html`<p>x</p>` }), host);
  const section = host.querySelector("section.dx-card")!;
  const heading = host.querySelector("h2.dx-card-title")!;
  const id = heading.getAttribute("id");
  assert.ok(id, "heading has an id");
  assert.equal(section.getAttribute("aria-labelledby"), id, "section points at its heading");
});

test("dataTable sortable header is keyboard-operable and exposes reactive aria-sort", () => {
  const host = body();
  render(
    dataTable<Row>({
      title: "Accounts",
      columns: [
        { key: "name", label: "Name", sortable: true },
        { key: "mrr", label: "MRR", numeric: true, sortable: true, value: (r) => r.mrr },
      ],
      rows,
      rowKey: (r) => r.id,
      pageSize: 10,
    }),
    host,
  );

  const mrrTh = [...host.querySelectorAll("th.is-sortable")].find((th) => th.textContent!.includes("MRR"))! as HTMLElement;
  // Focusable (keyboard reachable), unlike a bare <th>.
  assert.equal(mrrTh.getAttribute("tabindex"), "0");
  // Initially unsorted.
  assert.equal(mrrTh.getAttribute("aria-sort"), "none");

  const mrrCol = () => [...host.querySelectorAll("tbody tr")].map((tr) => Number(tr.children[1]!.textContent));

  // Sort via KEYBOARD (Enter), not a mouse click.
  mrrTh.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.equal(mrrTh.getAttribute("aria-sort"), "ascending", "aria-sort reflects ascending");
  let vals = mrrCol();
  assert.deepEqual(vals, [...vals].sort((a, b) => a - b), "rows sorted ascending");

  // Space toggles to descending.
  mrrTh.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
  assert.equal(mrrTh.getAttribute("aria-sort"), "descending");
  vals = mrrCol();
  assert.deepEqual(vals, [...vals].sort((a, b) => b - a), "rows sorted descending");

  // Non-sortable table bits are labelled / hidden appropriately.
  assert.equal(host.querySelector("table.dx-tbl")!.getAttribute("aria-label"), "Accounts");
  assert.equal(host.querySelector(".dx-tbl-search input")!.getAttribute("aria-label"), "Search Accounts");
  assert.equal(host.querySelector(".dx-arrow")!.getAttribute("aria-hidden"), "true");
  const prev = [...host.querySelectorAll(".dx-btn")].find((b) => b.getAttribute("aria-label") === "Previous page");
  assert.ok(prev, "pagination buttons have accessible names");
});

test("dataTable empty state is a status region", () => {
  const host = body();
  render(
    dataTable<Row>({
      columns: [{ key: "name", label: "Name" }],
      rows: [],
      rowKey: (r) => r.id,
    }),
    host,
  );
  const empty = host.querySelector(".dx-tbl-empty")!;
  assert.equal(empty.getAttribute("role"), "status");
});
