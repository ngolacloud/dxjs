import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { renderToString } from "../src/index.ts";

test("renders static markup", () => {
  assert.equal(renderToString(html`<p class="x">hi</p>`), '<p class="x">hi</p>');
});

test("escapes text children (no injection in SSR output)", () => {
  const s = renderToString(html`<div>${'<img onerror="x">'}</div>`);
  assert.equal(s, "<div>&lt;img onerror=&quot;x&quot;&gt;</div>");
});

test("unwraps reactive values (snapshot)", () => {
  const n = signal(7);
  assert.equal(renderToString(html`<b>${() => n()}</b>`), "<b>7</b>");
});

test("quoted attribute is escaped", () => {
  const s = renderToString(html`<div title="${'" x="y'}"></div>`);
  assert.equal(s, '<div title="&quot; x=&quot;y"></div>');
});

test("unquoted attribute gets quotes", () => {
  assert.equal(renderToString(html`<div class=${"a"}></div>`), '<div class="a"></div>');
});

test("boolean ?attr: true emits the attribute, false omits it", () => {
  assert.equal(renderToString(html`<button ?disabled=${true}>x</button>`), "<button disabled>x</button>");
  assert.equal(renderToString(html`<button ?disabled=${false}>x</button>`), "<button >x</button>");
});

test(".property renders as its attribute", () => {
  assert.equal(renderToString(html`<input .value=${"hi"}>`), '<input value="hi">');
});

test("@event handlers are dropped (no server listeners)", () => {
  assert.equal(renderToString(html`<button @click=${() => {}}>go</button>`), "<button >go</button>");
});

test("nested templates and arrays", () => {
  const s = renderToString(html`<ul>${[html`<li>a</li>`, html`<li>b</li>`]}</ul>`);
  assert.equal(s, "<ul><li>a</li><li>b</li></ul>");
});

test("null/false attribute is omitted", () => {
  assert.equal(renderToString(html`<a href=${null}>x</a>`), "<a >x</a>");
});
