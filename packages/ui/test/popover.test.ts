import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { html, render } from "@dxjs/dom";
import { popover, popconfirm, contextMenu } from "../src/popover.ts";

const key = (el: Element, k: string): void =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

const rightClick = (el: Element, x = 120, y = 80): void =>
  el.dispatchEvent(
    new (globalThis as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent("contextmenu", {
      bubbles: true,
      clientX: x,
      clientY: y,
    }),
  );

// --- Popover ---------------------------------------------------------------
test("popover: hidden until click, opens as a dialog, toggles, Escape closes", () => {
  const host = body();
  render(
    popover({
      trigger: "Open",
      content: html`<p id="pc">Panel body</p>`,
      placement: "top",
      align: "end",
      ariaLabel: "Details",
    }),
    host,
  );
  const trigger = host.querySelector(".dx-pop-trigger")!;
  const panel = host.querySelector(".dx-pop-panel")!;
  assert.equal(trigger.getAttribute("aria-haspopup"), "dialog");
  assert.equal(trigger.getAttribute("aria-label"), "Details");
  assert.equal(panel.getAttribute("role"), "dialog");
  assert.ok(panel.classList.contains("is-top"));
  assert.ok(panel.classList.contains("is-align-end"));
  assert.ok(panel.hasAttribute("hidden"));
  assert.equal(trigger.getAttribute("aria-expanded"), "false");

  fire(trigger, "click");
  assert.equal(panel.hasAttribute("hidden"), false);
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  assert.equal(host.querySelector("#pc")!.textContent, "Panel body");

  // A second click toggles it shut.
  fire(trigger, "click");
  assert.ok(panel.hasAttribute("hidden"));

  // Open again, then Escape closes.
  fire(trigger, "click");
  assert.equal(panel.hasAttribute("hidden"), false);
  key(host.querySelector(".dx-pop")!, "Escape");
  assert.ok(panel.hasAttribute("hidden"));
});

test("popover: focus leaving the root closes it", () => {
  const host = body();
  render(popover({ trigger: "Open", content: "Body" }), host);
  const trigger = host.querySelector(".dx-pop-trigger")!;
  const panel = host.querySelector(".dx-pop-panel")!;
  fire(trigger, "click");
  assert.equal(panel.hasAttribute("hidden"), false);
  // focusout with no relatedTarget = focus left the root → close.
  fire(host.querySelector(".dx-pop")!, "focusout");
  assert.ok(panel.hasAttribute("hidden"));
});

// --- Popconfirm ------------------------------------------------------------
test("popconfirm: shows title/message, Confirm fires onConfirm and closes", () => {
  const host = body();
  let confirmed = 0;
  let cancelled = 0;
  render(
    popconfirm({
      trigger: "Delete",
      title: "Delete item?",
      message: "This cannot be undone.",
      confirmLabel: "Yes, delete",
      onConfirm: () => confirmed++,
      onCancel: () => cancelled++,
    }),
    host,
  );
  const trigger = host.querySelector(".dx-pop-trigger")!;
  const panel = host.querySelector(".dx-popconfirm")!;
  assert.ok(panel.classList.contains("is-neg"));
  assert.ok(panel.hasAttribute("hidden"));
  assert.ok(panel.getAttribute("aria-labelledby"));

  fire(trigger, "click");
  assert.equal(panel.hasAttribute("hidden"), false);
  assert.equal(host.querySelector(".dx-popconfirm-title")!.textContent, "Delete item?");
  assert.equal(host.querySelector(".dx-popconfirm-msg")!.textContent, "This cannot be undone.");

  const confirmBtn = [...panel.querySelectorAll(".dx-btn")].find((b) => b.textContent!.includes("Yes, delete"))!;
  fire(confirmBtn, "click");
  assert.equal(confirmed, 1);
  assert.equal(cancelled, 0);
  assert.ok(panel.hasAttribute("hidden"));
});

test("popconfirm: Cancel button and Escape both cancel", () => {
  const host = body();
  let confirmed = 0;
  let cancelled = 0;
  render(
    popconfirm({
      trigger: "Archive",
      title: "Archive?",
      tone: "warn",
      onConfirm: () => confirmed++,
      onCancel: () => cancelled++,
    }),
    host,
  );
  const trigger = host.querySelector(".dx-pop-trigger")!;
  const panel = host.querySelector(".dx-popconfirm")!;
  assert.ok(panel.classList.contains("is-warn"));

  // Cancel button.
  fire(trigger, "click");
  const cancelBtn = [...panel.querySelectorAll(".dx-btn")].find((b) => b.textContent!.includes("Cancel"))!;
  fire(cancelBtn, "click");
  assert.equal(cancelled, 1);
  assert.ok(panel.hasAttribute("hidden"));

  // Escape also cancels.
  fire(trigger, "click");
  key(host.querySelector(".dx-pop")!, "Escape");
  assert.equal(cancelled, 2);
  assert.equal(confirmed, 0);
  assert.ok(panel.hasAttribute("hidden"));
});

// --- Context menu ----------------------------------------------------------
test("contextMenu: right-click opens a positioned menu; select fires and closes", () => {
  const host = body();
  let picked = "";
  render(
    contextMenu({
      ariaLabel: "Row actions",
      children: html`<div id="cmslot">Right-click me</div>`,
      items: [
        { label: "Open", icon: "folder", onSelect: () => (picked = "Open") },
        { label: "Rename", onSelect: () => (picked = "Rename") },
        { label: "Delete", icon: "trash", danger: true, separator: true, onSelect: () => (picked = "Delete") },
      ],
    }),
    host,
  );
  const root = host.querySelector(".dx-cm-root")!;
  const menu = host.querySelector(".dx-cm")! as HTMLElement;
  assert.equal(menu.getAttribute("role"), "menu");
  assert.equal(menu.getAttribute("aria-label"), "Row actions");
  assert.ok(menu.hasAttribute("hidden"));
  assert.equal(host.querySelector("#cmslot")!.textContent, "Right-click me");

  rightClick(root, 150, 90);
  assert.equal(menu.hasAttribute("hidden"), false);
  assert.equal(menu.style.getPropertyValue("--dx-cm-x"), "150px");
  assert.equal(menu.style.getPropertyValue("--dx-cm-y"), "90px");
  assert.equal(host.querySelectorAll(".dx-cm-item").length, 3);
  assert.ok(host.querySelector(".dx-cm-sep"));
  assert.ok(host.querySelector(".dx-cm-item.is-danger"));
  assert.equal(host.querySelectorAll(".dx-cm-ico").length, 2);

  const rename = [...host.querySelectorAll(".dx-cm-item")].find((b) => b.textContent!.includes("Rename"))!;
  fire(rename, "click");
  assert.equal(picked, "Rename");
  assert.ok(menu.hasAttribute("hidden"));
});

test("contextMenu: disabled item does not fire; arrows move active; Escape closes", () => {
  const host = body();
  let picked = "";
  render(
    contextMenu({
      children: "slot",
      items: [
        { label: "One", onSelect: () => (picked = "One") },
        { label: "Two", disabled: true, onSelect: () => (picked = "Two") },
        { label: "Three", onSelect: () => (picked = "Three") },
      ],
    }),
    host,
  );
  const root = host.querySelector(".dx-cm-root")!;
  const menu = host.querySelector(".dx-cm")! as HTMLElement;
  rightClick(root);

  // Clicking the disabled item does nothing.
  const two = [...host.querySelectorAll(".dx-cm-item")].find((b) => b.textContent!.includes("Two"))!;
  fire(two, "click");
  assert.equal(picked, "");

  // ArrowDown highlights the first enabled (One), then skips disabled Two → Three.
  key(root, "ArrowDown");
  assert.ok(host.querySelector(".dx-cm-item.is-active")!.textContent!.includes("One"));
  key(root, "ArrowDown");
  assert.ok(host.querySelector(".dx-cm-item.is-active")!.textContent!.includes("Three"));
  key(root, "Enter");
  assert.equal(picked, "Three");
  assert.ok(menu.hasAttribute("hidden"));

  // Reopen, Escape closes.
  rightClick(root);
  assert.equal(menu.hasAttribute("hidden"), false);
  key(root, "Escape");
  assert.ok(menu.hasAttribute("hidden"));
});
