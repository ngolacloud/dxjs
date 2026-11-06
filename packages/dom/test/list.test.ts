import { body } from "./setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html, list, render } from "../src/index.ts";

interface Row {
  id: string;
  name: string;
}

function setup() {
  const host = body();
  const items = signal<Row[]>([
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
  ]);
  const dispose = render(
    html`<ul>${list(
      () => items(),
      (r) => r.id,
      (r) => html`<li data-k=${r.id}>${r.name}</li>`,
    )}</ul>`,
    host,
  );
  return { host, items, dispose };
}

const keys = (host: Element): string[] =>
  [...host.querySelectorAll("li")].map((li) => li.getAttribute("data-k")!);

test("keyed list renders initial rows in order", () => {
  const { host, dispose } = setup();
  assert.deepEqual(keys(host), ["a", "b", "c"]);
  dispose();
});

test("reorder preserves row node identity (keyed, not rebuilt)", () => {
  const { host, items, dispose } = setup();
  const liA = host.querySelector('[data-k="a"]')!;
  const liB = host.querySelector('[data-k="b"]')!;
  items.set([
    { id: "c", name: "C" },
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ]);
  assert.deepEqual(keys(host), ["c", "a", "b"]);
  assert.equal(host.querySelector('[data-k="a"]'), liA, "row 'a' is the same DOM node after reorder");
  assert.equal(host.querySelector('[data-k="b"]'), liB, "row 'b' is the same DOM node after reorder");
  dispose();
});

test("adding an item inserts a new row, keeping existing identities", () => {
  const { host, items, dispose } = setup();
  const liA = host.querySelector('[data-k="a"]')!;
  items.set([
    { id: "a", name: "A" },
    { id: "b", name: "B" },
    { id: "c", name: "C" },
    { id: "d", name: "D" },
  ]);
  assert.deepEqual(keys(host), ["a", "b", "c", "d"]);
  assert.equal(host.querySelector('[data-k="a"]'), liA, "existing row identity preserved");
  dispose();
});

test("removing an item disposes just that row", () => {
  const { host, items, dispose } = setup();
  const liC = host.querySelector('[data-k="c"]')!;
  items.set([{ id: "a", name: "A" }]);
  assert.deepEqual(keys(host), ["a"]);
  assert.equal(liC.isConnected, false, "removed row detached");
  dispose();
});

test("dispose removes all rows", () => {
  const { host, dispose } = setup();
  assert.equal(host.querySelectorAll("li").length, 3);
  dispose();
  assert.equal(host.querySelectorAll("li").length, 0);
});

test("SSR (hydratable) renders keyed list items", async () => {
  const { renderToString } = await import("../../server/src/render.ts");
  const out = renderToString(
    html`<ul>${list(
      [{ id: "x", name: "X" }, { id: "y", name: "Y" }],
      (r: Row) => r.id,
      (r: Row) => html`<li>${r.name}</li>`,
    )}</ul>`,
  );
  assert.equal(out, "<ul><li>X</li><li>Y</li></ul>");
});
