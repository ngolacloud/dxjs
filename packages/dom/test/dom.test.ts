import { body, fire } from "./setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html, render, escape } from "../src/index.ts";

test("renders static markup", () => {
  const host = body();
  render(html`<p class="x">hello</p>`, host);
  assert.equal(host.innerHTML, '<p class="x">hello</p>');
});

test("reactive text child updates via textContent (surgical)", () => {
  const host = body();
  const n = signal(1);
  render(html`<span>count: ${() => n()}</span>`, host);
  const span = host.querySelector("span")!;
  assert.equal(span.textContent, "count: 1");
  n.set(2);
  assert.equal(span.textContent, "count: 2");
});

test("data is escaped — no HTML injection through a text binding (XSS-safe)", () => {
  const host = body();
  const name = signal('<img src=x onerror="window.__xss=1">');
  render(html`<div>${() => name()}</div>`, host);
  const div = host.querySelector("div")!;
  assert.equal(div.querySelector("img"), null, "no element created from data");
  assert.equal((globalThis as Record<string, unknown>).__xss, undefined);
  assert.ok(div.textContent!.includes("<img"), "rendered as literal text");
});

test("reactive attribute binding", () => {
  const host = body();
  const cls = signal("a");
  render(html`<div class=${() => cls()}></div>`, host);
  const div = host.querySelector("div")!;
  assert.equal(div.getAttribute("class"), "a");
  cls.set("b");
  assert.equal(div.getAttribute("class"), "b");
});

test("attribute value is escaped (no breakout)", () => {
  const host = body();
  render(html`<div title=${'" onmouseover="x'}></div>`, host);
  const div = host.querySelector("div")!;
  assert.equal(div.getAttribute("title"), '" onmouseover="x');
  assert.equal(div.getAttribute("onmouseover"), null, "no injected handler attribute");
});

test("boolean ?attr toggles", () => {
  const host = body();
  const on = signal(true);
  render(html`<button ?disabled=${() => on()}>go</button>`, host);
  const btn = host.querySelector("button")!;
  assert.equal(btn.hasAttribute("disabled"), true);
  on.set(false);
  assert.equal(btn.hasAttribute("disabled"), false);
});

test(".property binding", () => {
  const host = body();
  const v = signal("hi");
  render(html`<input .value=${() => v()}>`, host);
  const input = host.querySelector("input")! as unknown as { value: string };
  assert.equal(input.value, "hi");
  v.set("bye");
  assert.equal(input.value, "bye");
});

test("@event binds via addEventListener (no inline handler attribute)", () => {
  const host = body();
  const n = signal(0);
  render(html`<button @click=${() => n.update((x) => x + 1)}>+</button>`, host);
  const btn = host.querySelector("button")!;
  assert.equal(btn.getAttribute("onclick"), null, "must not be an inline onclick attribute");
  fire(btn, "click");
  fire(btn, "click");
  assert.equal(n.peek(), 2);
});

test("nested templates render", () => {
  const host = body();
  render(html`<ul>${html`<li>one</li>`}</ul>`, host);
  assert.equal(host.querySelector("li")!.textContent, "one");
});

test("reactive list (array child) re-renders", () => {
  const host = body();
  const items = signal(["a", "b"]);
  render(html`<ul>${() => items().map((i) => html`<li>${i}</li>`)}</ul>`, host);
  assert.equal(host.querySelectorAll("li").length, 2);
  items.set(["a", "b", "c"]);
  assert.equal(host.querySelectorAll("li").length, 3);
  items.set(["z"]);
  assert.equal(host.querySelectorAll("li").length, 1);
  assert.equal(host.querySelector("li")!.textContent, "z");
});

test("dispose tears down: removes nodes, stops effects, removes listeners", () => {
  const host = body();
  const n = signal(0);
  let clicks = 0;
  const dispose = render(
    html`<button @click=${() => { clicks++; }}>${() => n()}</button>`,
    host,
  );
  const btn = host.querySelector("button")!;
  fire(btn, "click");
  assert.equal(clicks, 1);
  dispose();
  assert.equal(host.querySelector("button"), null, "nodes removed");
  // listener gone + effect stopped: further activity must not touch anything
  fire(btn, "click");
  assert.equal(clicks, 1, "listener removed on dispose");
  n.set(5); // effect disposed → no throw, no work
  assert.equal(clicks, 1);
});

test("escape() helper covers the five HTML metacharacters", () => {
  assert.equal(escape(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
});
