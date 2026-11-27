import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { buildSlots, timePicker } from "../src/timepicker.ts";

const key = (el: Element, k: string): void =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

// --- buildSlots ------------------------------------------------------------
test("buildSlots: default-like steps produce the right count and endpoints", () => {
  const q = buildSlots(15);
  assert.equal(q.length, 96);
  assert.equal(q[0], "00:00");
  assert.equal(q[1], "00:15");
  assert.equal(q[q.length - 1], "23:45");

  assert.equal(buildSlots(30).length, 48);
  assert.equal(buildSlots(60).length, 24);
  const minute = buildSlots(1);
  assert.equal(minute.length, 24 * 60);
  assert.equal(minute[minute.length - 1], "23:59");
});

test("buildSlots: step is clamped to a minimum of one minute", () => {
  assert.equal(buildSlots(0).length, 24 * 60);
  assert.equal(buildSlots(-5).length, 24 * 60);
});

// --- timePicker face -------------------------------------------------------
test("timePicker: shows the placeholder with no value, listbox hidden", () => {
  const host = body();
  render(timePicker({ placeholder: "Pick a time", ariaLabel: "Start" }), host);
  const face = host.querySelector(".dx-tmp-face")!;
  assert.equal(face.getAttribute("aria-haspopup"), "listbox");
  assert.equal(face.getAttribute("aria-expanded"), "false");
  assert.ok(face.getAttribute("aria-controls"));
  assert.equal(host.querySelector(".dx-tmp-val")!.textContent, "Pick a time");
  assert.ok(host.querySelector(".dx-tmp-val")!.classList.contains("is-placeholder"));
  assert.ok(host.querySelector(".dx-tmp-ico svg"));

  const pop = host.querySelector(".dx-tmp-pop")!;
  assert.equal(pop.getAttribute("role"), "listbox");
  assert.ok(pop.hasAttribute("hidden"));
});

test("timePicker: a value shows formatted 24h text and is not a placeholder", () => {
  const host = body();
  render(timePicker({ value: "09:30" }), host);
  const val = host.querySelector(".dx-tmp-val")!;
  assert.equal(val.textContent, "09:30");
  assert.equal(val.classList.contains("is-placeholder"), false);
});

// --- open + select ---------------------------------------------------------
test("timePicker: opens on click, listbox shows the slots, aria-selected marks current", () => {
  const host = body();
  render(timePicker({ value: "01:00", step: 60 }), host);
  const face = host.querySelector(".dx-tmp-face")!;
  const pop = host.querySelector(".dx-tmp-pop")!;

  fire(face, "click");
  assert.equal(face.getAttribute("aria-expanded"), "true");
  assert.equal(pop.hasAttribute("hidden"), false);
  // step 60 → 24 options.
  assert.equal(host.querySelectorAll(".dx-tmp-opt").length, 24);

  const selected = [...host.querySelectorAll(".dx-tmp-opt")].filter(
    (b) => b.getAttribute("aria-selected") === "true",
  );
  assert.equal(selected.length, 1);
  assert.equal(selected[0].textContent, "01:00");
  assert.ok(selected[0].classList.contains("is-selected"));
});

test("timePicker: clicking an option calls onChange with HH:MM and closes", () => {
  const host = body();
  let picked = "";
  render(
    timePicker({ value: "00:00", step: 30, onChange: (v) => (picked = v) }),
    host,
  );
  fire(host.querySelector(".dx-tmp-face")!, "click");
  const opt = [...host.querySelectorAll(".dx-tmp-opt")].find((b) => b.textContent === "02:30")!;
  fire(opt, "click");
  assert.equal(picked, "02:30");
  assert.ok(host.querySelector(".dx-tmp-pop")!.hasAttribute("hidden"));
  assert.equal(host.querySelector(".dx-tmp-face")!.getAttribute("aria-expanded"), "false");
});

// --- hour12 ----------------------------------------------------------------
test("timePicker: hour12 formats the face + options but keeps the value 24h", () => {
  const host = body();
  let picked = "";
  render(
    timePicker({ value: "13:30", step: 30, hour12: true, onChange: (v) => (picked = v) }),
    host,
  );
  assert.equal(host.querySelector(".dx-tmp-val")!.textContent, "1:30 PM");

  fire(host.querySelector(".dx-tmp-face")!, "click");
  // Midnight renders as 12:00 AM; noon as 12:00 PM.
  assert.ok([...host.querySelectorAll(".dx-tmp-opt")].some((b) => b.textContent === "12:00 AM"));
  const noon = [...host.querySelectorAll(".dx-tmp-opt")].find((b) => b.textContent === "12:00 PM")!;
  fire(noon, "click");
  // Stored value is the 24h form.
  assert.equal(picked, "12:00");
});

// --- keyboard + close ------------------------------------------------------
test("timePicker: ArrowDown opens and moves the active option; Enter commits", () => {
  const host = body();
  let picked = "";
  render(timePicker({ step: 60, onChange: (v) => (picked = v) }), host);
  const root = host.querySelector(".dx-tmp")!;

  // First ArrowDown opens and activates the first slot (00:00).
  key(root, "ArrowDown");
  assert.equal(host.querySelector(".dx-tmp-face")!.getAttribute("aria-expanded"), "true");
  assert.ok(host.querySelector(".dx-tmp-opt.is-active")!.textContent === "00:00");
  // Second ArrowDown → 01:00.
  key(root, "ArrowDown");
  assert.equal(host.querySelector(".dx-tmp-opt.is-active")!.textContent, "01:00");
  key(root, "Enter");
  assert.equal(picked, "01:00");
  assert.ok(host.querySelector(".dx-tmp-pop")!.hasAttribute("hidden"));
});

test("timePicker: Escape closes the open popover", () => {
  const host = body();
  render(timePicker({ value: "08:00", step: 60 }), host);
  const root = host.querySelector(".dx-tmp")!;
  fire(host.querySelector(".dx-tmp-face")!, "click");
  assert.equal(host.querySelector(".dx-tmp-pop")!.hasAttribute("hidden"), false);
  key(root, "Escape");
  assert.ok(host.querySelector(".dx-tmp-pop")!.hasAttribute("hidden"));
});

test("timePicker: disabled face button is disabled", () => {
  const host = body();
  const dis = signal(true);
  render(timePicker({ value: "08:00", disabled: () => dis() }), host);
  const face = host.querySelector(".dx-tmp-face")! as HTMLButtonElement;
  assert.equal(face.disabled, true);
  dis.set(false);
  assert.equal(face.disabled, false);
});
