import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { topProgress, tagsInput, dateRangePicker } from "../src/index.ts";

// --- topProgress -----------------------------------------------------------
test("topProgress: determinate fill width tracks value (SVG attribute, no style)", () => {
  const host = body();
  const v = signal(0.4);
  render(topProgress({ value: () => v(), tone: "info" }), host);
  const bar = host.querySelector(".dx-topbar")!;
  assert.equal(bar.getAttribute("role"), "progressbar");
  assert.ok(bar.classList.contains("is-info"));
  const fill = host.querySelector(".dx-topbar-fill")!;
  assert.equal(fill.getAttribute("width"), "40");
  // the fill is an attribute, never an inline style (CSP)
  assert.equal(fill.hasAttribute("style"), false);

  v.set(0.9);
  assert.equal(fill.getAttribute("width"), "90");
  // out-of-range clamps
  v.set(2);
  assert.equal(fill.getAttribute("width"), "100");
});

test("topProgress: indeterminate with no value; done hides it", () => {
  const host = body();
  const done = signal(false);
  render(topProgress({ done: () => done() }), host);
  const bar = host.querySelector(".dx-topbar")!;
  assert.ok(bar.classList.contains("is-indeterminate"));
  assert.equal(host.querySelector(".dx-topbar-fill")!.getAttribute("width"), "100");
  assert.equal(bar.getAttribute("aria-hidden"), "false");
  done.set(true);
  assert.ok(bar.classList.contains("is-done"));
  assert.equal(bar.getAttribute("aria-hidden"), "true");
});

// --- tagsInput -------------------------------------------------------------
test("tagsInput: renders tags; Enter adds, × removes, Backspace pops last", () => {
  const host = body();
  const tags = signal<string[]>(["ui"]);
  render(
    tagsInput({ value: () => tags(), onChange: (t) => tags.set(t), placeholder: "Add…" }),
    host,
  );
  assert.equal(host.querySelectorAll(".dx-tag").length, 1);
  const inp = host.querySelector(".dx-tags-input")! as unknown as HTMLInputElement;

  // type "api" then Enter → added
  inp.value = "api";
  fire(inp, "input");
  inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.deepEqual(tags(), ["ui", "api"]);
  assert.equal(host.querySelectorAll(".dx-tag").length, 2);

  // × on the first tag removes it
  fire(host.querySelector(".dx-tag-x")!, "click");
  assert.deepEqual(tags(), ["api"]);

  // Backspace on an empty draft pops the last tag
  inp.value = "";
  fire(inp, "input");
  inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", bubbles: true }));
  assert.deepEqual(tags(), []);
});

test("tagsInput: unique rejects a duplicate; comma separator commits", () => {
  const host = body();
  const tags = signal<string[]>(["a"]);
  render(tagsInput({ value: () => tags(), onChange: (t) => tags.set(t) }), host);
  const inp = host.querySelector(".dx-tags-input")! as unknown as HTMLInputElement;

  // duplicate "a" rejected
  inp.value = "a";
  fire(inp, "input");
  inp.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.deepEqual(tags(), ["a"]);

  // comma commits "b"
  inp.value = "b";
  fire(inp, "input");
  inp.dispatchEvent(new KeyboardEvent("keydown", { key: ",", bubbles: true }));
  assert.deepEqual(tags(), ["a", "b"]);
});

// --- dateRangePicker -------------------------------------------------------
const cellByDay = (host: Element, day: string): Element =>
  [...host.querySelectorAll(".dx-dp-cell")].find((c) => c.textContent === day && !c.classList.contains("is-empty"))!;

test("dateRangePicker: picking start then a later end reports both", () => {
  const host = body();
  const start = signal("2026-06-15");
  const end = signal("");
  render(
    dateRangePicker({
      start: () => start(),
      end: () => end(),
      onChange: (s, e) => {
        start.set(s);
        end.set(e);
      },
    }),
    host,
  );
  fire(host.querySelector(".dx-dr-face")!, "click");
  // month seeded from start → June 2026 is visible
  fire(cellByDay(host, "20"), "click");
  assert.equal(start(), "2026-06-15");
  assert.equal(end(), "2026-06-20");
  assert.ok(host.querySelector(".dx-dr-face")!.textContent!.includes("2026-06-15 → 2026-06-20"));
});

test("dateRangePicker: the span between ends is highlighted; a complete range restarts", () => {
  const host = body();
  const start = signal("2026-06-15");
  const end = signal("2026-06-20");
  render(
    dateRangePicker({
      start: () => start(),
      end: () => end(),
      onChange: (s, e) => {
        start.set(s);
        end.set(e);
      },
    }),
    host,
  );
  // 15 and 20 are the selected ends; 17 is inside the range
  assert.ok(cellByDay(host, "15").classList.contains("is-selected"));
  assert.ok(cellByDay(host, "20").classList.contains("is-selected"));
  assert.ok(cellByDay(host, "17").classList.contains("is-in-range"));
  assert.equal(cellByDay(host, "21").classList.contains("is-in-range"), false);

  // range is complete → clicking day 10 starts a new range
  fire(cellByDay(host, "10"), "click");
  assert.equal(start(), "2026-06-10");
  assert.equal(end(), "");
});
