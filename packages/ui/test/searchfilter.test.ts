import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "@dxjs/dom";
import { searchFilter, matchFacets, type Facet } from "../src/index.ts";

interface Row { name: string; city: string; }
const get = (r: Row, f: string): string => (r as Record<string, string>)[f] ?? "";

test("matchFacets: OR within a field, AND across fields", () => {
  const rows: Row[] = [
    { name: "Acme", city: "Luanda" },
    { name: "Globex", city: "Benguela" },
    { name: "Acme", city: "Benguela" },
  ];
  const f = (field: string, value: string): Facet => ({ field, label: field, value });
  // city=Luanda OR city=Benguela  → all three
  assert.equal(rows.filter((r) => matchFacets(r, [f("city", "Luanda"), f("city", "Benguela")], get)).length, 3);
  // name=Acme AND city=Benguela → one
  assert.equal(rows.filter((r) => matchFacets(r, [f("name", "Acme"), f("city", "Benguela")], get)).length, 1);
  // empty → all
  assert.equal(rows.filter((r) => matchFacets(r, [], get)).length, 3);
});

test("searchFilter: typing + Enter adds a facet; Backspace removes it; onChange fires", () => {
  const host = body();
  let state = { facets: [] as Facet[], filters: [] as string[], groupBy: [] as string[] };
  render(
    searchFilter({
      fields: [{ key: "name", label: "Name" }, { key: "city", label: "City" }],
      filters: [{ id: "active", label: "Active" }],
      onChange: (s) => (state = s),
    }),
    host,
  );
  const input = host.querySelector(".dx-sf-input")! as unknown as HTMLInputElement;
  input.value = "acme";
  fire(input as unknown as Element, "input");
  // suggestions appear (one per field)
  assert.equal(host.querySelector(".dx-sf-suggest")!.hasAttribute("hidden"), false);
  assert.equal(host.querySelectorAll(".dx-sf-sugg").length, 2);
  // Enter → facet on the first field (Name)
  (host.querySelector(".dx-sf-input")! as Element).dispatchEvent(new (globalThis as any).KeyboardEvent("keydown", { key: "Enter", cancelable: true, bubbles: true }));
  assert.equal(state.facets.length, 1);
  assert.equal(state.facets[0]!.field, "name");
  assert.equal(state.facets[0]!.value, "acme");
  assert.equal(host.querySelectorAll(".dx-sf-facet").length, 1, "a facet chip rendered");
  // Backspace on empty input removes the last facet
  (host.querySelector(".dx-sf-input")! as Element).dispatchEvent(new (globalThis as any).KeyboardEvent("keydown", { key: "Backspace", cancelable: true, bubbles: true }));
  assert.equal(state.facets.length, 0);
});

test("searchFilter: Filters menu toggles a filter via onChange", () => {
  const host = body();
  let filters: string[] = [];
  render(
    searchFilter({
      fields: [{ key: "name", label: "Name" }],
      filters: [{ id: "active", label: "Active" }, { id: "trial", label: "Trial" }],
      onChange: (s) => (filters = s.filters),
    }),
    host,
  );
  fire(host.querySelector(".dx-sf-mbtn")!, "click");
  const items = host.querySelectorAll(".dx-sf-mitem");
  assert.equal(items.length, 2);
  fire(items[1]!, "click"); // Trial
  assert.deepEqual(filters, ["trial"]);
});

test("searchFilter: Ctrl+K focuses the search input", () => {
  const host = body();
  render(searchFilter({ fields: [{ key: "name", label: "Name" }] }), host);
  const input = host.querySelector(".dx-sf-input")!;
  const doc = (globalThis as any).document;
  doc.dispatchEvent(new (globalThis as any).KeyboardEvent("keydown", { key: "k", ctrlKey: true, cancelable: true, bubbles: true }));
  assert.equal(doc.activeElement, input, "Ctrl+K moved focus to the search input");
});
