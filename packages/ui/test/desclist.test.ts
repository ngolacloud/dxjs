import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html, render } from "@dxjs/dom";
import { descriptionList, type DescItem } from "../src/desclist.ts";

test("descriptionList: renders a dl of dt/dd pairs with the right text", () => {
  const host = body();
  render(
    descriptionList({
      items: [
        { term: "Name", value: "Seiva" },
        { term: "Status", value: html`<strong id="st">Live</strong>` },
      ],
    }),
    host,
  );
  const dl = host.querySelector(".dx-dl")!;
  assert.ok(dl);
  assert.equal(dl.tagName.toLowerCase(), "dl");
  const items = host.querySelectorAll(".dx-dl-item");
  assert.equal(items.length, 2);
  const terms = [...host.querySelectorAll(".dx-dl-term")].map((t) => t.textContent);
  assert.deepEqual(terms, ["Name", "Status"]);
  assert.equal(host.querySelector(".dx-dl-value")!.textContent, "Seiva");
  // A template value renders as real markup, not text.
  assert.ok(host.querySelector("#st"));
  assert.equal(host.querySelector("#st")!.textContent, "Live");
});

test("descriptionList: defaults are a single inline column, no borders", () => {
  const host = body();
  render(descriptionList({ items: [{ term: "A", value: "1" }] }), host);
  const dl = host.querySelector(".dx-dl")!;
  assert.ok(dl.classList.contains("is-cols-1"));
  assert.ok(dl.classList.contains("is-inline"));
  assert.equal(dl.classList.contains("is-stacked"), false);
  assert.equal(dl.classList.contains("is-bordered"), false);
});

test("descriptionList: columns and stacked layout and bordered toggle classes", () => {
  const host = body();
  render(
    descriptionList({
      items: [{ term: "A", value: "1" }],
      columns: 3,
      layout: "stacked",
      bordered: true,
    }),
    host,
  );
  const dl = host.querySelector(".dx-dl")!;
  assert.ok(dl.classList.contains("is-cols-3"));
  assert.ok(dl.classList.contains("is-stacked"));
  assert.equal(dl.classList.contains("is-inline"), false);
  assert.ok(dl.classList.contains("is-bordered"));
});

test("descriptionList: a spanning item gets is-span; others do not", () => {
  const host = body();
  render(
    descriptionList({
      columns: 2,
      items: [
        { term: "Short", value: "x" },
        { term: "Note", value: "a long remark", span: true },
      ],
    }),
    host,
  );
  const items = host.querySelectorAll(".dx-dl-item");
  assert.equal(items[0].classList.contains("is-span"), false);
  assert.ok(items[1].classList.contains("is-span"));
});

test("descriptionList: a reactive value accessor updates in place", () => {
  const host = body();
  const state = signal("pending");
  render(
    descriptionList({ items: [{ term: "State", value: () => state() }] }),
    host,
  );
  assert.equal(host.querySelector(".dx-dl-value")!.textContent, "pending");
  state.set("active");
  assert.equal(host.querySelector(".dx-dl-value")!.textContent, "active");
});

test("descriptionList: a reactive items accessor re-renders the rows", () => {
  const host = body();
  const items = signal<DescItem[]>([{ term: "One", value: "1" }]);
  render(descriptionList({ items: () => items() }), host);
  assert.equal(host.querySelectorAll(".dx-dl-item").length, 1);
  items.set([
    { term: "One", value: "1" },
    { term: "Two", value: "2" },
  ]);
  assert.equal(host.querySelectorAll(".dx-dl-item").length, 2);
  assert.equal(host.querySelectorAll(".dx-dl-term")[1].textContent, "Two");
});

test("descriptionList: empty / absent items renders an empty dl", () => {
  const host = body();
  render(descriptionList({ items: [] }), host);
  assert.ok(host.querySelector(".dx-dl"));
  assert.equal(host.querySelectorAll(".dx-dl-item").length, 0);
});
