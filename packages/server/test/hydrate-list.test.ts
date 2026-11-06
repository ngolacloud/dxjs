import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { renderToString, hydrate } from "../src/index.ts";

test("hydrate manages a reactive LIST child while preserving the static parent", () => {
  const items = signal(["a", "b", "c"]);
  const view = html`<ul>${() => items().map((i) => html`<li>${i}</li>`)}</ul>`;

  const host = body();
  host.innerHTML = renderToString(view, { hydratable: true }); // server output

  // Capture the static parent's identity BEFORE hydration.
  const ul = host.querySelector("ul")!;
  assert.equal(host.querySelectorAll("li").length, 3, "SSR emitted one <li> per item");

  const dispose = hydrate(view, host);

  // (a) the static parent is the SAME node — nothing above the range recreated.
  assert.equal(host.querySelector("ul"), ul);
  // (b) initial count matches the SSR.
  assert.equal(ul.querySelectorAll("li").length, 3);
  assert.deepEqual(
    Array.from(ul.querySelectorAll("li")).map((n) => n.textContent),
    ["a", "b", "c"],
  );

  // (c) adding an item is reflected in the DOM.
  items.set(["a", "b", "c", "d"]);
  assert.equal(ul.querySelectorAll("li").length, 4);
  assert.deepEqual(
    Array.from(ul.querySelectorAll("li")).map((n) => n.textContent),
    ["a", "b", "c", "d"],
  );

  // (d) removing / reordering is reflected too.
  items.set(["d", "a"]);
  assert.equal(ul.querySelectorAll("li").length, 2);
  assert.deepEqual(
    Array.from(ul.querySelectorAll("li")).map((n) => n.textContent),
    ["d", "a"],
  );

  // (e) dispose tears everything down; further signal writes do nothing.
  dispose();
  const afterDispose = ul.querySelectorAll("li").length;
  items.set(["x", "y", "z"]);
  assert.equal(ul.querySelectorAll("li").length, afterDispose, "no reaction after dispose");
});

test("hydrate swaps between two nested templates on signal change", () => {
  const showA = signal(true);
  const view = html`<div>${() => (showA() ? html`<span>A</span>` : html`<p>B</p>`)}</div>`;

  const host = body();
  host.innerHTML = renderToString(view, { hydratable: true });

  const div = host.querySelector("div")!;
  const dispose = hydrate(view, host);

  // Same static parent; initial branch rendered.
  assert.equal(host.querySelector("div"), div);
  assert.equal(div.querySelector("span")?.textContent, "A");
  assert.equal(div.querySelector("p"), null);

  // Swap to the other template.
  showA.set(false);
  assert.equal(div.querySelector("span"), null);
  assert.equal(div.querySelector("p")?.textContent, "B");

  // Swap back.
  showA.set(true);
  assert.equal(div.querySelector("span")?.textContent, "A");
  assert.equal(div.querySelector("p"), null);

  dispose();
});
