import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html, render } from "@dxjs/dom";
import { swipeActions, pullToRefresh, pickerWheel, wheelIndexOf, PULL_THRESHOLD } from "../src/touch.ts";

const key = (el: Element, k: string): void =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

// --- swipeActions ----------------------------------------------------------
test("swipeActions: renders surface + action buttons; clicking an action fires onSelect", () => {
  const host = body();
  let picked = "";
  render(
    swipeActions({
      ariaLabel: "Message row",
      children: html`<span id="rowtext">Inbox item</span>`,
      actions: [
        { label: "Archive", icon: "box", tone: "info", onSelect: () => (picked = "Archive") },
        { label: "Delete", icon: "trash", tone: "neg", onSelect: () => (picked = "Delete") },
      ],
    }),
    host,
  );

  const root = host.querySelector(".dx-swipe")!;
  assert.equal(root.getAttribute("role"), "group");
  assert.equal(root.getAttribute("aria-label"), "Message row");
  assert.ok(host.querySelector(".dx-swipe-surface"));
  assert.equal(host.querySelector("#rowtext")!.textContent, "Inbox item");

  const buttons = [...host.querySelectorAll(".dx-swipe-action")];
  assert.equal(buttons.length, 2);
  // Tone class and icon are rendered.
  assert.ok(host.querySelector(".dx-swipe-action.is-neg"));
  assert.equal(host.querySelectorAll(".dx-swipe-ico .dx-icon").length, 2);
  assert.equal(buttons[0].querySelector(".dx-swipe-label")!.textContent, "Archive");

  fire(buttons[1], "click");
  assert.equal(picked, "Delete");
  // Choosing an action snaps the row closed.
  assert.equal(root.classList.contains("is-open"), false);
});

// --- pullToRefresh ---------------------------------------------------------
test("pullToRefresh: the refresh button calls onRefresh and reflects busy state", async () => {
  const host = body();
  let calls = 0;
  let release!: () => void;
  render(
    pullToRefresh({
      children: html`<p id="feed">feed</p>`,
      onRefresh: () => {
        calls++;
        return new Promise<void>((r) => (release = r));
      },
    }),
    host,
  );

  const root = host.querySelector(".dx-ptr")!;
  const btn = host.querySelector(".dx-ptr-btn")!;
  assert.equal(host.querySelector("#feed")!.textContent, "feed");
  assert.equal(root.hasAttribute("aria-busy"), false);
  assert.equal(host.querySelector(".dx-ptr-label")!.textContent, "Pull to refresh");

  fire(btn, "click");
  assert.equal(calls, 1);
  // While the promise is pending, the control is busy.
  assert.equal(root.getAttribute("aria-busy"), "true");
  assert.ok(root.classList.contains("is-busy"));
  assert.ok((btn as HTMLButtonElement).disabled);
  assert.equal(host.querySelector(".dx-ptr-label")!.textContent, "Refreshing…");

  // A second click while busy is ignored.
  fire(btn, "click");
  assert.equal(calls, 1);

  release();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(root.hasAttribute("aria-busy"), false);
  assert.equal((btn as HTMLButtonElement).disabled, false);
});

test("pullToRefresh: an externally controlled `refreshing` accessor disables the button", () => {
  const host = body();
  const refreshing = signal(false);
  render(
    pullToRefresh({
      children: "x",
      refreshing: () => refreshing(),
      onRefresh: () => {},
    }),
    host,
  );
  const btn = host.querySelector(".dx-ptr-btn") as HTMLButtonElement;
  assert.equal(btn.disabled, false);
  refreshing.set(true);
  assert.equal(btn.disabled, true);
  assert.equal(host.querySelector(".dx-ptr")!.getAttribute("aria-busy"), "true");
});

// --- pickerWheel -----------------------------------------------------------
test("wheelIndexOf: finds the row, clamps a missing value to 0", () => {
  const opts = [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C" }];
  assert.equal(wheelIndexOf(opts, "b"), 1);
  assert.equal(wheelIndexOf(opts, "zzz"), 0);
  assert.equal(PULL_THRESHOLD, 72);
});

test("pickerWheel: options render as listbox rows; selected is highlighted + active", () => {
  const host = body();
  const value = signal("feb");
  render(
    pickerWheel({
      ariaLabel: "Month",
      value: () => value(),
      options: [
        { value: "jan", label: "January" },
        { value: "feb", label: "February" },
        { value: "mar", label: "March" },
      ],
      onChange: (v) => value.set(v),
    }),
    host,
  );

  const box = host.querySelector(".dx-wheel")!;
  assert.equal(box.getAttribute("role"), "listbox");
  assert.equal(box.getAttribute("tabindex"), "0");
  const opts = [...host.querySelectorAll(".dx-wheel-opt")];
  assert.equal(opts.length, 3);
  opts.forEach((op) => assert.equal(op.getAttribute("role"), "option"));

  // Initially "feb" is selected and the active descendant points at it.
  const sel = () => host.querySelector(".dx-wheel-opt.is-selected")!;
  assert.equal(sel().textContent, "February");
  assert.equal(sel().getAttribute("aria-selected"), "true");
  assert.equal(box.getAttribute("aria-activedescendant"), sel().id);
});

test("pickerWheel: clicking a row and ArrowUp/Down change the selection", () => {
  const host = body();
  const value = signal("feb");
  render(
    pickerWheel({
      value: () => value(),
      options: [
        { value: "jan", label: "January" },
        { value: "feb", label: "February" },
        { value: "mar", label: "March" },
      ],
      onChange: (v) => value.set(v),
    }),
    host,
  );
  const box = host.querySelector(".dx-wheel")!;

  // Click the first row → jan.
  const jan = [...host.querySelectorAll(".dx-wheel-opt")].find((o) => o.textContent === "January")!;
  fire(jan, "click");
  assert.equal(value(), "jan");
  assert.equal(host.querySelector(".dx-wheel-opt.is-selected")!.textContent, "January");

  // ArrowDown moves to the next row.
  key(box, "ArrowDown");
  assert.equal(value(), "feb");
  // ArrowUp back to the first.
  key(box, "ArrowUp");
  assert.equal(value(), "jan");
  // ArrowUp at the top edge is a no-op (clamped).
  key(box, "ArrowUp");
  assert.equal(value(), "jan");
  // End jumps to the last row.
  key(box, "End");
  assert.equal(value(), "mar");
});
