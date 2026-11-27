import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { pagination } from "../src/pagination.ts";

const pageButtons = (host: Element): HTMLButtonElement[] =>
  [...host.querySelectorAll(".dx-pg-page")] as HTMLButtonElement[];
const texts = (host: Element): string[] => pageButtons(host).map((b) => b.textContent!.trim());

// --- Structure & a11y ------------------------------------------------------
test("pagination: nav is labelled, prev disabled at start, aria-current on active", () => {
  const host = body();
  render(pagination({ page: 0, pageCount: 5, onPage: () => {} }), host);

  const nav = host.querySelector("nav.dx-pg")!;
  assert.equal(nav.getAttribute("aria-label"), "Pagination");

  const prev = host.querySelector(".dx-pg-prev") as HTMLButtonElement;
  const next = host.querySelector(".dx-pg-next") as HTMLButtonElement;
  assert.equal(prev.getAttribute("aria-label"), "Previous page");
  assert.equal(next.getAttribute("aria-label"), "Next page");
  assert.ok(prev.hasAttribute("disabled"), "prev disabled on first page");
  assert.equal(next.hasAttribute("disabled"), false, "next enabled on first page");

  // Five pages, all visible, 1 is current.
  assert.deepEqual(texts(host), ["1", "2", "3", "4", "5"]);
  const active = host.querySelector(".dx-pg-page.is-current")!;
  assert.equal(active.textContent!.trim(), "1");
  assert.equal(active.getAttribute("aria-current"), "page");
  // Non-active buttons omit aria-current entirely.
  const two = pageButtons(host).find((b) => b.textContent!.trim() === "2")!;
  assert.equal(two.hasAttribute("aria-current"), false);
});

test("pagination: next disabled on the last page", () => {
  const host = body();
  render(pagination({ page: 4, pageCount: 5 }), host);
  const prev = host.querySelector(".dx-pg-prev") as HTMLButtonElement;
  const next = host.querySelector(".dx-pg-next") as HTMLButtonElement;
  assert.equal(prev.hasAttribute("disabled"), false);
  assert.ok(next.hasAttribute("disabled"));
});

// --- Navigation ------------------------------------------------------------
test("pagination: clicking a page / next calls onPage with a 0-based index", () => {
  const host = body();
  const seen: number[] = [];
  render(pagination({ page: 0, pageCount: 5, onPage: (p) => seen.push(p) }), host);

  const three = pageButtons(host).find((b) => b.textContent!.trim() === "3")!;
  fire(three, "click");
  fire(host.querySelector(".dx-pg-next")!, "click");
  // Page 3 → index 2; next from page 0 → index 1.
  assert.deepEqual(seen, [2, 1]);
});

test("pagination: prev at the start and clicking the current page are no-ops", () => {
  const host = body();
  const seen: number[] = [];
  render(pagination({ page: 0, pageCount: 5, onPage: (p) => seen.push(p) }), host);
  fire(host.querySelector(".dx-pg-prev")!, "click"); // disabled / clamped
  const one = pageButtons(host).find((b) => b.textContent!.trim() === "1")!;
  fire(one, "click"); // already current
  assert.deepEqual(seen, []);
});

// --- Ellipsis window -------------------------------------------------------
test("pagination: long range collapses with an ellipsis gap, edges pinned", () => {
  const host = body();
  render(pagination({ page: 0, pageCount: 10 }), host);
  // Expect 1 2 3 4 5 … 10 — one gap, first & last pinned.
  assert.equal(host.querySelectorAll(".dx-pg-gap").length, 1);
  assert.deepEqual(texts(host), ["1", "2", "3", "4", "5", "10"]);
});

test("pagination: a centred page shows two gaps around the sibling window", () => {
  const host = body();
  render(pagination({ page: 9, pageCount: 20, siblingCount: 1 }), host);
  // 1 … 9 10 11 … 20
  assert.equal(host.querySelectorAll(".dx-pg-gap").length, 2);
  assert.deepEqual(texts(host), ["1", "9", "10", "11", "20"]);
});

test("pagination: siblingCount widens the window", () => {
  const host = body();
  render(pagination({ page: 9, pageCount: 20, siblingCount: 2 }), host);
  // 1 … 8 9 10 11 12 … 20
  assert.deepEqual(texts(host), ["1", "8", "9", "10", "11", "12", "20"]);
});

test("pagination: showEdges=false drops the pinned boundary pages", () => {
  const host = body();
  render(pagination({ page: 9, pageCount: 20, showEdges: false }), host);
  // No pinned 1 or 20, just the sibling block between two gaps.
  assert.equal(host.querySelectorAll(".dx-pg-gap").length, 2);
  assert.deepEqual(texts(host), ["9", "10", "11"]);
});

// --- Reactivity ------------------------------------------------------------
test("pagination: reacts to a page signal (current marker + disabled states)", () => {
  const host = body();
  const page = signal(0);
  render(pagination({ page: () => page(), pageCount: 5 }), host);
  assert.ok((host.querySelector(".dx-pg-prev") as HTMLButtonElement).hasAttribute("disabled"));

  page.set(4);
  assert.equal(host.querySelector(".dx-pg-page.is-current")!.textContent!.trim(), "5");
  assert.ok((host.querySelector(".dx-pg-next") as HTMLButtonElement).hasAttribute("disabled"));
  assert.equal((host.querySelector(".dx-pg-prev") as HTMLButtonElement).hasAttribute("disabled"), false);
});

// --- Range label + page size ----------------------------------------------
test("pagination: labelRange shows X–Y of Z and derives pageCount", () => {
  const host = body();
  // 95 items, 10 per page → 10 pages; page index 2 (0-based) → items 21–30.
  render(pagination({ page: 2, total: 95, pageSize: 10, labelRange: true }), host);
  assert.equal(host.querySelector(".dx-pg-range")!.textContent!.trim(), "21–30 of 95");
  // Derived 10 pages → last page button is "10".
  assert.ok(texts(host).includes("10"));
});

test("pagination: last-page range label clamps to the total", () => {
  const host = body();
  render(pagination({ page: 9, total: 95, pageSize: 10, labelRange: true }), host);
  assert.equal(host.querySelector(".dx-pg-range")!.textContent!.trim(), "91–95 of 95");
});

test("pagination: pageSizes renders a select that reports changes", () => {
  const host = body();
  let picked = 0;
  render(
    pagination({
      page: 0,
      pageCount: 3,
      pageSize: 25,
      pageSizes: [10, 25, 50],
      onPageSize: (n) => (picked = n),
    }),
    host,
  );
  const select = host.querySelector(".dx-pg-select") as HTMLSelectElement;
  assert.ok(select, "select rendered");
  assert.equal(select.getAttribute("aria-label"), "Rows per page");
  assert.equal(host.querySelectorAll(".dx-pg-select option").length, 3);
  assert.equal(select.value, "25");

  select.value = "50";
  fire(select, "change");
  assert.equal(picked, 50);
});

test("pagination: no select when pageSizes is absent", () => {
  const host = body();
  render(pagination({ page: 0, pageCount: 3 }), host);
  assert.equal(host.querySelector(".dx-pg-select"), null);
});
