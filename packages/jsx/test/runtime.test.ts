// Runtime behaviour of the JSX bridge, exercised through the SAME calls the TS
// JSX transform emits: `jsx(type, props)` / `jsxs` / `Fragment`. (Node strips TS
// types natively but does NOT transform JSX syntax — the .tsx syntax + typing is
// proven by the type gate and the esbuild e2e; here we prove the realized DOM and
// its fine-grained reactivity against a standards DOM.)
import { body, fire } from "./setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render, html, list } from "@dxjs/dom";
import { jsx, jsxs, Fragment } from "../src/jsx-runtime.ts";

test("realizes an element with an attribute and a text child", () => {
  const host = body();
  render(jsx("p", { class: "x", children: "hello" }), host);
  assert.equal(host.innerHTML, '<p class="x">hello</p>');
});

test("a reactive child updates surgically — the sibling node is not recreated", () => {
  const host = body();
  const n = signal(1);
  render(
    jsxs("div", {
      children: [jsx("span", { id: "s", children: "static" }), jsx("b", { children: () => n() })],
    }),
    host,
  );
  const span = host.querySelector("#s")!;
  const b = host.querySelector("b")!;
  assert.equal(b.textContent, "1");
  n.set(2);
  assert.equal(b.textContent, "2", "reactive node updated");
  assert.ok(host.querySelector("#s") === span, "static sibling kept its identity");
});

test("a reactive attribute updates through the attribute sink", () => {
  const host = body();
  const tone = signal("pos");
  render(jsx("div", { class: () => `pill ${tone()}` }), host);
  const div = host.querySelector("div")!;
  assert.equal(div.getAttribute("class"), "pill pos");
  tone.set("neg");
  assert.equal(div.getAttribute("class"), "pill neg");
});

test("onClick binds via addEventListener (no inline handler attribute)", () => {
  const host = body();
  const n = signal(0);
  render(jsx("button", { onClick: () => n.set(n() + 1), children: "+" }), host);
  const btn = host.querySelector("button")!;
  assert.equal(btn.getAttribute("onclick"), null, "never an inline on*= attribute");
  fire(btn, "click");
  fire(btn, "click");
  assert.equal(n(), 2, "listener fired twice");
});

test("a function component runs once and renders its view", () => {
  const host = body();
  const Badge = (props: { label: string }) => jsx("span", { class: "badge", children: props.label });
  render(jsx(Badge, { label: "ok" }), host);
  assert.equal(host.innerHTML, '<span class="badge">ok</span>');
});

test("Fragment renders children with no wrapper element", () => {
  const host = body();
  render(jsxs(Fragment, { children: [jsx("i", { children: "a" }), jsx("i", { children: "b" })] }), host);
  assert.equal(host.innerHTML, "<i>a</i><i>b</i>");
});

test("a keyed list child reconciles by key (identity preserved on reorder)", () => {
  const host = body();
  const items = signal([
    { id: 1, t: "a" },
    { id: 2, t: "b" },
  ]);
  render(
    jsx("ul", {
      children: list(
        () => items(),
        (i) => i.id,
        (i) => html`<li>${i.t}</li>`,
      ),
    }),
    host,
  );
  const firstLi = host.querySelector("li")!;
  items.set([
    { id: 2, t: "b" },
    { id: 1, t: "a" },
  ]);
  assert.equal(
    [...host.querySelectorAll("li")].map((l) => l.textContent).join(","),
    "b,a",
    "reordered",
  );
  assert.ok(
    [...host.querySelectorAll("li")].some((l) => l === firstLi),
    "the row for id=1 kept its DOM node across the reorder",
  );
});

test("JSX and html`…` interleave both ways", () => {
  const host = body();
  // html inside JSX children…
  render(jsx("section", { children: html`<em>x</em>` }), host);
  assert.equal(host.innerHTML, "<section><em>x</em></section>");
  // …and JSX inside an html binding.
  const host2 = body();
  render(html`<div>${jsx("mark", { children: "y" })}</div>`, host2);
  assert.equal(host2.innerHTML, "<div><mark>y</mark></div>");
});

test("value binds as a live property on form controls", () => {
  const host = body();
  const v = signal("one");
  render(jsx("input", { value: () => v() }), host);
  const input = host.querySelector("input") as unknown as { value: string };
  assert.equal(input.value, "one");
  v.set("two");
  assert.equal(input.value, "two", "property updated reactively");
});

test("render returns a disposer that tears down listeners and nodes", () => {
  const host = body();
  const n = signal(0);
  const dispose = render(jsx("button", { onClick: () => n.set(n() + 1), children: "x" }), host);
  const btn = host.querySelector("button")!;
  dispose();
  assert.equal(host.innerHTML, "", "nodes removed");
  fire(btn, "click");
  assert.equal(n(), 0, "listener removed on dispose");
});
