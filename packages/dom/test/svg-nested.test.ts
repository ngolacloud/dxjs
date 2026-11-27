// A template interpolated INSIDE an <svg> must create SVG elements. Parsed on its
// own, `<path/>` lands in the HTML namespace (an unknown element that draws
// nothing): @dxjs/ui's icon() rendered empty icons in 1.4 because of this.
import { body } from "./setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html, list, render } from "../src/index.ts";

const SVG = "http://www.w3.org/2000/svg";
const XHTML = "http://www.w3.org/1999/xhtml";

test("a nested template inside <svg> creates SVG elements", () => {
  const host = body();
  const dispose = render(html`<svg viewBox="0 0 24 24">${html`<path d="M1 1h4" /><circle cx="3" cy="3" r="1" />`}</svg>`, host);
  const path = host.querySelector("path")!;
  const circle = host.querySelector("circle")!;
  assert.equal(path.namespaceURI, SVG);
  assert.equal(circle.namespaceURI, SVG);
  assert.equal(path.getAttribute("d"), "M1 1h4");
  dispose();
});

test("reactive and nested-again children inside <svg> stay SVG", () => {
  const host = body();
  const big = signal(false);
  const dispose = render(
    html`<svg>${() => (big() ? html`<g>${html`<rect width=${10} height="2" />`}</g>` : html`<circle r="1" />`)}</svg>`,
    host,
  );
  assert.equal(host.querySelector("circle")!.namespaceURI, SVG);
  big.set(true);
  assert.equal(host.querySelector("g")!.namespaceURI, SVG);
  const rect = host.querySelector("rect")!;
  assert.equal(rect.namespaceURI, SVG);
  assert.equal(rect.getAttribute("width"), "10");
  dispose();
});

test("keyed list rows inside <svg> are SVG", () => {
  const host = body();
  const items = signal([1, 2]);
  const dispose = render(html`<svg>${list(items, (i) => i, (i) => html`<circle r=${i} />`)}</svg>`, host);
  items.set([1, 2, 3]);
  const circles = [...host.querySelectorAll("circle")];
  assert.equal(circles.length, 3);
  for (const c of circles) assert.equal(c.namespaceURI, SVG);
  dispose();
});

test("HTML inside <foreignObject>, and next to an <svg>, stays HTML", () => {
  const host = body();
  const dispose = render(
    html`<div><svg><foreignObject>${html`<span>a</span>`}</foreignObject></svg>${html`<span>b</span>`}</div>`,
    host,
  );
  const [a, b] = [...host.querySelectorAll("span")];
  assert.equal(a!.namespaceURI, XHTML);
  assert.equal(b!.namespaceURI, XHTML);
  dispose();
});
