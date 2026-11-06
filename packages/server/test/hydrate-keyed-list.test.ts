import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html, list } from "@dxjs/dom";
import { renderToString, hydrate } from "../src/index.ts";

interface Row {
  id: string;
  n: string;
}
const kseq = (host: Element): string[] =>
  [...host.querySelectorAll("li")].map((li) => li.getAttribute("data-k")!);

test("hydrate reconciles a keyed list() with stable node identity", () => {
  const items = signal<Row[]>([
    { id: "a", n: "A" },
    { id: "b", n: "B" },
  ]);
  const view = html`<ul>${list(
    () => items(),
    (r) => r.id,
    (r) => html`<li data-k=${r.id}>${r.n}</li>`,
  )}</ul>`;

  const host = body();
  host.innerHTML = renderToString(view, { hydratable: true }); // server HTML (<li>A</li><li>B</li>)
  const ul = host.querySelector("ul")!;

  hydrate(view, host);
  assert.equal(host.querySelector("ul"), ul, "static <ul> parent identity preserved");
  assert.deepEqual(kseq(host), ["a", "b"]);
  const liA = host.querySelector('[data-k="a"]')!;

  // Reorder → keyed reuse keeps the same DOM node.
  items.set([
    { id: "b", n: "B" },
    { id: "a", n: "A" },
  ]);
  assert.deepEqual(kseq(host), ["b", "a"]);
  assert.equal(host.querySelector('[data-k="a"]'), liA, "row 'a' is the same node after reorder");

  // Add + remove reflect reactively after hydration.
  items.set([{ id: "b", n: "B" }, { id: "a", n: "A" }, { id: "c", n: "C" }]);
  assert.equal(host.querySelectorAll("li").length, 3);
  items.set([{ id: "a", n: "A" }]);
  assert.deepEqual(kseq(host), ["a"]);
});
