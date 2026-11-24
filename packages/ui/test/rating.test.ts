import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { starRating } from "../src/rating.ts";

test("starRating: read-only renders max stars, right number filled", () => {
  const host = body();
  render(starRating({ value: 3 }), host);
  const stars = host.querySelectorAll(".dx-star");
  assert.equal(stars.length, 5, "default max = 5");
  const full = host.querySelectorAll(".dx-star.is-full");
  assert.equal(full.length, 3, "value 3 ⇒ 3 full stars");
  // Read-only: rendered as spans (no buttons), with an aria-label summary.
  assert.equal(host.querySelectorAll("button").length, 0, "read-only ⇒ no buttons");
  assert.equal(host.querySelector(".dx-rating")!.getAttribute("aria-label"), "3 of 5 stars");
});

test("starRating: honours max", () => {
  const host = body();
  render(starRating({ value: 2, max: 10 }), host);
  assert.equal(host.querySelectorAll(".dx-star").length, 10);
});

test("starRating: interactive click on 3rd star ⇒ onChange(3)", () => {
  const host = body();
  let got = -1;
  render(starRating({ value: 0, onChange: (v) => (got = v) }), host);
  const buttons = host.querySelectorAll("button.dx-star");
  assert.equal(buttons.length, 5, "interactive ⇒ radio buttons");
  assert.equal(host.querySelector(".dx-rating")!.getAttribute("role"), "radiogroup");
  assert.equal(buttons[0]!.getAttribute("role"), "radio");
  fire(buttons[2]!, "click");
  assert.equal(got, 3, "clicking the 3rd star selects 3");
});

test("starRating: fill class reflects value reactively", () => {
  const host = body();
  const value = signal(1);
  render(starRating({ value: () => value(), onChange: () => {} }), host);
  assert.equal(host.querySelectorAll(".dx-star.is-full").length, 1);
  assert.equal(host.querySelectorAll("button[aria-checked='true']").length, 1);
  value.set(4);
  assert.equal(host.querySelectorAll(".dx-star.is-full").length, 4, "fill tracks the signal");
  assert.equal(host.querySelectorAll("button[aria-checked='true']").length, 4);
});

test("starRating: Left/Right keyboard changes value", () => {
  const host = body();
  let got = -1;
  render(starRating({ value: 2, onChange: (v) => (got = v) }), host);
  const group = host.querySelector(".dx-rating")! as unknown as HTMLElement;
  group.dispatchEvent(new (globalThis as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.equal(got, 3, "ArrowRight increments");
  group.dispatchEvent(new (globalThis as unknown as { KeyboardEvent: typeof KeyboardEvent }).KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  assert.equal(got, 1, "ArrowLeft decrements");
});
