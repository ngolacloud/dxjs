import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html, render } from "@dxjs/dom";
import { appShell, statGrid, dataTable } from "../src/index.ts";

interface Company {
  id: string;
  name: string;
  mrr: number;
}
const companies = (n: number): Company[] =>
  Array.from({ length: n }, (_, i) => ({ id: `c${i}`, name: `Company ${String.fromCharCode(90 - (i % 26))}${i}`, mrr: (i * 37) % 1000 }));

test("statGrid renders a tile per metric", () => {
  const host = body();
  render(statGrid([
    { label: "ACTIVE", value: "1,247", delta: "+12.4%", tone: "pos" },
    { label: "CHURN", value: "2.1%", delta: "-0.3%", tone: "neg" },
  ]), host);
  const tiles = host.querySelectorAll(".dx-stat");
  assert.equal(tiles.length, 2);
  assert.equal(host.querySelector(".dx-stat-value")!.textContent, "1,247");
  assert.ok(host.querySelector(".dx-stat-delta.is-pos"));
});

test("appShell renders brand + nav + content, and nav click fires onSelect", () => {
  const host = body();
  let picked = "";
  render(
    appShell({
      brand: "TalentPros",
      nav: [
        { label: "Overview", active: true },
        { label: "Companies", onSelect: () => (picked = "Companies") },
      ],
      content: html`<p id="c">hello</p>`,
    }),
    host,
  );
  assert.equal(host.querySelector(".dx-brand")!.textContent, "TalentPros");
  assert.equal(host.querySelectorAll(".dx-nav-item").length, 2);
  assert.ok(host.querySelector(".dx-nav-item.is-active"));
  assert.equal(host.querySelector("#c")!.textContent, "hello");
  const companiesBtn = [...host.querySelectorAll(".dx-nav-item")].find((b) => b.textContent!.includes("Companies"))!;
  companiesBtn.dispatchEvent(new Event("click"));
  assert.equal(picked, "Companies");
});

test("appShell nav reflects a reactive active selection", () => {
  const host = body();
  const active = signal("a");
  render(
    appShell({
      brand: "X",
      nav: () => [
        { label: "Alpha", active: active() === "a", onSelect: () => active.set("a") },
        { label: "Beta", active: active() === "b", onSelect: () => active.set("b") },
      ],
      content: html`<p>c</p>`,
    }),
    host,
  );
  const find = (t: string) => [...host.querySelectorAll(".dx-nav-item")].find((b) => b.textContent!.includes(t))!;
  assert.ok(find("Alpha").classList.contains("is-active"), "Alpha active initially");
  // Reactive: changing the signal moves the highlight (keyed list() would not re-render it).
  active.set("b");
  assert.ok(find("Beta").classList.contains("is-active"), "Beta active after selection");
  assert.ok(!find("Alpha").classList.contains("is-active"), "Alpha no longer active");
});

test("appShell renders a topbar slot in place of search", () => {
  const host = body();
  render(
    appShell({
      brand: "Seiva Admin",
      nav: [{ label: "Accounts", active: true }],
      topbar: html`<div class="dx-search"><input id="token" /></div>`,
      content: html`<p>body</p>`,
    }),
    host,
  );
  assert.ok(host.querySelector(".dx-top #token"), "the topbar content lives in the top bar");
});

test("dataTable paginates, searches and sorts", () => {
  const host = body();
  const rows = signal(companies(12));
  render(
    dataTable<Company>({
      title: "Companies",
      columns: [
        { key: "name", label: "Name", sortable: true },
        { key: "mrr", label: "MRR", numeric: true, sortable: true, value: (r) => r.mrr },
      ],
      rows: () => rows(),
      rowKey: (r) => r.id,
      pageSize: 5,
    }),
    host,
  );

  const rowCount = () => host.querySelectorAll("tbody tr").length;
  const mrrCol = () => [...host.querySelectorAll("tbody tr")].map((tr) => Number(tr.children[1]!.textContent));

  // Page 1 shows pageSize rows.
  assert.equal(rowCount(), 5);
  assert.ok(host.querySelector(".dx-tbl-foot")!.textContent!.includes("of 12"));

  // Next page.
  const next = [...host.querySelectorAll(".dx-btn")].find((b) => b.textContent!.includes("Next"))!;
  next.dispatchEvent(new Event("click"));
  assert.equal(rowCount(), 5); // page 2 also full (12 → 5/5/2)
  next.dispatchEvent(new Event("click"));
  assert.equal(rowCount(), 2); // page 3 has the remainder

  // Sorting the MRR column makes the visible page monotonic (asc or desc).
  const mrrHeader = [...host.querySelectorAll("th.is-sortable")].find((th) => th.textContent!.includes("MRR"))!;
  mrrHeader.dispatchEvent(new Event("click"));
  const vals = mrrCol();
  const asc = vals.every((v, i) => i === 0 || vals[i - 1]! <= v);
  const desc = vals.every((v, i) => i === 0 || vals[i - 1]! >= v);
  assert.ok(asc || desc, `sorted column must be monotonic, got ${vals}`);

  // Searching narrows the rows.
  const search = host.querySelector(".dx-tbl-search input") as HTMLInputElement;
  search.value = "Company Z0";
  search.dispatchEvent(new Event("input"));
  assert.ok(rowCount() <= 2, "search narrows the result set");
});
