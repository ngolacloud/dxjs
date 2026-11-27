import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { slider, numberInput } from "../src/numinputs.ts";

const styleVar = (el: Element, name: string): string =>
  (el as unknown as { style: CSSStyleDeclaration }).style.getPropertyValue(name).trim();

// --- Slider ----------------------------------------------------------------
test("slider: renders a range input bound to value with min/max/step and fill", () => {
  const host = body();
  const v = signal(25);
  render(slider({ value: () => v(), min: 0, max: 100, step: 5, ariaLabel: "Volume" }), host);

  const input = host.querySelector(".dx-sld-input") as HTMLInputElement;
  assert.equal(input.getAttribute("type"), "range");
  assert.equal(input.getAttribute("min"), "0");
  assert.equal(input.getAttribute("max"), "100");
  assert.equal(input.getAttribute("step"), "5");
  assert.equal(input.getAttribute("aria-label"), "Volume");
  assert.equal(input.value, "25");

  // Fill percentage is exposed as a CSS custom property on the container.
  const root = host.querySelector(".dx-sld")!;
  assert.equal(styleVar(root, "--dx-slider-pct"), "25%");

  // Reactive: moving the value updates both the bound value and the fill var.
  v.set(75);
  assert.equal(input.value, "75");
  assert.equal(styleVar(root, "--dx-slider-pct"), "75%");
});

test("slider: input and change events report the numeric value", () => {
  const host = body();
  const v = signal(10);
  const inputs: number[] = [];
  const changes: number[] = [];
  render(
    slider({
      value: () => v(),
      min: 0,
      max: 100,
      onInput: (n) => inputs.push(n),
      onChange: (n) => changes.push(n),
    }),
    host,
  );
  const input = host.querySelector(".dx-sld-input") as HTMLInputElement;

  input.value = "42";
  fire(input, "input");
  assert.deepEqual(inputs, [42]);
  assert.equal(typeof inputs[0], "number");

  input.value = "60";
  fire(input, "change");
  assert.deepEqual(changes, [60]);
});

test("slider: marks render a positioned, labelled ticks row (aria-hidden)", () => {
  const host = body();
  render(slider({ value: 50, min: 0, max: 100, marks: [0, 50, 100] }), host);

  const ticks = host.querySelector(".dx-sld-ticks")!;
  assert.equal(ticks.getAttribute("aria-hidden"), "true");
  const items = host.querySelectorAll(".dx-sld-tick");
  assert.equal(items.length, 3);
  // Each tick carries its position as a percentage custom property.
  assert.equal(styleVar(items[0]!, "--dx-tick-pct"), "0%");
  assert.equal(styleVar(items[1]!, "--dx-tick-pct"), "50%");
  assert.equal(styleVar(items[2]!, "--dx-tick-pct"), "100%");
  assert.equal(items[1]!.querySelector(".dx-sld-tick-label")!.textContent, "50");
});

test("slider: no marks row when marks omitted; disabled toggles the attribute", () => {
  const host = body();
  const off = signal(false);
  render(slider({ value: 0, disabled: () => off() }), host);
  assert.equal(host.querySelector(".dx-sld-ticks"), null);

  const input = host.querySelector(".dx-sld-input") as HTMLInputElement;
  assert.equal(input.hasAttribute("disabled"), false);
  off.set(true);
  assert.equal(input.hasAttribute("disabled"), true);
});

// --- Number input ----------------------------------------------------------
test("numberInput: + and − step and clamp; buttons disable at the bounds", () => {
  const host = body();
  const v = signal(2);
  render(
    numberInput({ value: () => v(), min: 0, max: 3, step: 1, onChange: (n) => v.set(n), ariaLabel: "Qty" }),
    host,
  );

  const dec = host.querySelector(".dx-num-dec") as HTMLButtonElement;
  const inc = host.querySelector(".dx-num-inc") as HTMLButtonElement;
  const field = host.querySelector(".dx-num-input") as HTMLInputElement;
  assert.equal(field.getAttribute("type"), "number");
  assert.equal(field.value, "2");
  assert.equal(host.querySelector(".dx-num")!.getAttribute("role"), "group");

  // Step up to the max.
  fire(inc, "click");
  assert.equal(v(), 3);
  assert.equal(field.value, "3");
  // At max, the + button is disabled and further clicks are no-ops.
  assert.equal(inc.hasAttribute("disabled"), true);
  assert.equal(dec.hasAttribute("disabled"), false);
  fire(inc, "click");
  assert.equal(v(), 3);

  // Step down to the min.
  fire(dec, "click");
  fire(dec, "click");
  fire(dec, "click");
  assert.equal(v(), 0);
  assert.equal(dec.hasAttribute("disabled"), true);
  assert.equal(inc.hasAttribute("disabled"), false);
});

test("numberInput: the + button carries the plus icon and − a text glyph", () => {
  const host = body();
  render(numberInput({ value: 1, min: 0, max: 10 }), host);
  assert.ok(host.querySelector(".dx-num-inc .dx-icon"), "plus icon in the increment button");
  assert.equal(host.querySelector(".dx-num-dec")!.textContent, "−");
});

test("numberInput: typing a value clamps it on commit", () => {
  const host = body();
  const v = signal(5);
  render(numberInput({ value: () => v(), min: 0, max: 10, onChange: (n) => v.set(n) }), host);
  const field = host.querySelector(".dx-num-input") as HTMLInputElement;

  field.value = "99";
  fire(field, "change");
  assert.equal(v(), 10);

  field.value = "-4";
  fire(field, "change");
  assert.equal(v(), 0);

  // A blank entry is ignored (no spurious onChange).
  v.set(5);
  field.value = "";
  fire(field, "change");
  assert.equal(v(), 5);
});

test("numberInput: disabled stops the steppers", () => {
  const host = body();
  const v = signal(4);
  render(numberInput({ value: () => v(), step: 1, disabled: true, onChange: (n) => v.set(n) }), host);
  const inc = host.querySelector(".dx-num-inc") as HTMLButtonElement;
  assert.equal(inc.hasAttribute("disabled"), true);
  fire(inc, "click");
  assert.equal(v(), 4);
});
