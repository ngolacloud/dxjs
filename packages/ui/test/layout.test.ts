import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { html, render } from "@dxjs/dom";
import { stack, grid, space, splitter } from "../src/layout.ts";

const key = (el: Element, k: string): void =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

// --- Stack -----------------------------------------------------------------
test("stack: defaults to a column; children render; no gap class without gap", () => {
  const host = body();
  render(stack({ children: [html`<span class="a">1</span>`, html`<span class="b">2</span>`] }), host);
  const el = host.querySelector(".dx-stack")!;
  assert.ok(el.classList.contains("is-col"));
  assert.equal(el.classList.contains("is-row"), false);
  assert.ok(host.querySelector(".a"));
  assert.ok(host.querySelector(".b"));
  // No gap/align/justify/wrap classes when those options are omitted.
  assert.equal([...el.classList].some((c) => c.startsWith("dx-gap-")), false);
  assert.equal(el.classList.contains("is-wrap"), false);
});

test("stack: row direction, gap tier, align/justify and wrap map to classes", () => {
  const host = body();
  render(
    stack({
      children: html`<span>x</span>`,
      direction: "row",
      gap: "lg",
      align: "center",
      justify: "between",
      wrap: true,
    }),
    host,
  );
  const el = host.querySelector(".dx-stack")!;
  assert.ok(el.classList.contains("is-row"));
  assert.ok(el.classList.contains("dx-gap-lg"));
  assert.ok(el.classList.contains("is-align-center"));
  assert.ok(el.classList.contains("is-justify-between"));
  assert.ok(el.classList.contains("is-wrap"));
});

test("stack: numeric gap alias resolves to a tier", () => {
  const host = body();
  render(stack({ children: html`<i>x</i>`, gap: 1 }), host);
  assert.ok(host.querySelector(".dx-stack.dx-gap-xs"));
});

// --- Grid ------------------------------------------------------------------
test("grid: fixed columns set --dx-grid-cols via ref, no is-auto", () => {
  const host = body();
  render(grid({ children: [html`<i>1</i>`, html`<i>2</i>`, html`<i>3</i>`], cols: 3 }), host);
  const el = host.querySelector(".dx-grid")! as HTMLElement;
  assert.equal(el.classList.contains("is-auto"), false);
  assert.equal(el.style.getPropertyValue("--dx-grid-cols"), "3");
  assert.equal(host.querySelectorAll(".dx-grid > i").length, 3);
});

test("grid: default column count is 2", () => {
  const host = body();
  render(grid({ children: html`<i>x</i>` }), host);
  const el = host.querySelector(".dx-grid")! as HTMLElement;
  assert.equal(el.style.getPropertyValue("--dx-grid-cols"), "2");
});

test("grid: minCol enables responsive auto-fit and sets --dx-grid-min", () => {
  const host = body();
  render(grid({ children: html`<i>x</i>`, minCol: 220, gap: "sm" }), host);
  const el = host.querySelector(".dx-grid")! as HTMLElement;
  assert.ok(el.classList.contains("is-auto"));
  assert.ok(el.classList.contains("dx-gap-sm"));
  assert.equal(el.style.getPropertyValue("--dx-grid-min"), "220px");
  // In auto mode the fixed column var is not set.
  assert.equal(el.style.getPropertyValue("--dx-grid-cols"), "");
});

// --- Space -----------------------------------------------------------------
test("space: a decorative spacer carries the gap tier class; default is md", () => {
  const host = body();
  render(space("xl"), host);
  const el = host.querySelector(".dx-space")!;
  assert.ok(el.classList.contains("dx-gap-xl"));
  assert.equal(el.getAttribute("aria-hidden"), "true");

  const host2 = body();
  render(space(), host2);
  assert.ok(host2.querySelector(".dx-space.dx-gap-md"));
});

// --- Splitter --------------------------------------------------------------
test("splitter: structure, separator a11y and initial ratio", () => {
  const host = body();
  render(splitter({ start: html`<p class="s">S</p>`, end: html`<p class="e">E</p>`, initial: 0.4 }), host);
  const root = host.querySelector(".dx-split")! as HTMLElement;
  assert.ok(root.classList.contains("is-horizontal"));
  assert.ok(host.querySelector(".dx-split-pane.is-start .s"));
  assert.ok(host.querySelector(".dx-split-pane.is-end .e"));

  const sep = host.querySelector(".dx-split-sep")!;
  assert.equal(sep.getAttribute("role"), "separator");
  assert.equal(sep.getAttribute("aria-orientation"), "vertical");
  assert.equal(sep.getAttribute("tabindex"), "0");
  assert.equal(sep.getAttribute("aria-valuenow"), "40");
  // The ratio rides a CSS custom property (set via ref), never a literal style= in source.
  assert.equal(root.style.getPropertyValue("--dx-split"), "0.4");
});

test("splitter: ArrowRight/Left nudge the ratio and update aria-valuenow", () => {
  const host = body();
  render(splitter({ start: html`<i>S</i>`, end: html`<i>E</i>` }), host);
  const root = host.querySelector(".dx-split")! as HTMLElement;
  const sep = host.querySelector(".dx-split-sep")!;
  assert.equal(sep.getAttribute("aria-valuenow"), "50");

  key(sep, "ArrowRight");
  assert.equal(sep.getAttribute("aria-valuenow"), "52");
  assert.equal(root.style.getPropertyValue("--dx-split"), "0.52");

  key(sep, "ArrowLeft");
  key(sep, "ArrowLeft");
  assert.equal(sep.getAttribute("aria-valuenow"), "48");

  key(sep, "Home");
  assert.equal(sep.getAttribute("aria-valuenow"), "0");
  key(sep, "End");
  assert.equal(sep.getAttribute("aria-valuenow"), "100");
});

test("splitter: vertical uses horizontal separator and Up/Down keys", () => {
  const host = body();
  render(splitter({ start: html`<i>S</i>`, end: html`<i>E</i>`, direction: "vertical" }), host);
  const root = host.querySelector(".dx-split")!;
  assert.ok(root.classList.contains("is-vertical"));
  const sep = host.querySelector(".dx-split-sep")!;
  assert.equal(sep.getAttribute("aria-orientation"), "horizontal");

  key(sep, "ArrowDown");
  assert.equal(sep.getAttribute("aria-valuenow"), "52");
  key(sep, "ArrowUp");
  assert.equal(sep.getAttribute("aria-valuenow"), "50");
  // Horizontal arrows do nothing in a vertical splitter.
  key(sep, "ArrowRight");
  assert.equal(sep.getAttribute("aria-valuenow"), "50");
});
