import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html, render } from "@dxjs/dom";
import { createToaster, drawer, dropdown } from "../src/index.ts";

const key = (el: Element, k: string): void =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

// --- Toaster ---------------------------------------------------------------
test("toaster: push renders a toast, dismiss removes it, clear empties", () => {
  const host = body();
  const toaster = createToaster();
  render(toaster.host(), host);
  assert.equal(host.querySelectorAll(".dx-toast").length, 0);

  const id = toaster.push({ tone: "pos", title: "Saved", message: "All good", duration: 0 });
  assert.equal(host.querySelectorAll(".dx-toast").length, 1);
  assert.equal(host.querySelector(".dx-toast-title")!.textContent, "Saved");
  assert.ok(host.querySelector(".dx-toast.is-pos"));
  assert.equal(host.querySelector(".dx-toaster")!.getAttribute("aria-live"), "polite");

  toaster.push({ message: "Second", duration: 0 });
  assert.equal(host.querySelectorAll(".dx-toast").length, 2);

  toaster.dismiss(id);
  assert.equal(host.querySelectorAll(".dx-toast").length, 1);

  toaster.clear();
  assert.equal(host.querySelectorAll(".dx-toast").length, 0);
});

test("toaster: a negative toast is an alert; dismiss button removes it", () => {
  const host = body();
  const toaster = createToaster();
  render(toaster.host({ placement: "bottom", align: "center" }), host);
  toaster.push({ tone: "neg", message: "Boom", duration: 0 });
  assert.equal(host.querySelector(".dx-toast")!.getAttribute("role"), "alert");
  assert.ok(host.querySelector(".dx-toaster.is-bottom.is-center"));
  fire(host.querySelector(".dx-toast-x")!, "click");
  assert.equal(host.querySelectorAll(".dx-toast").length, 0);
});

test("toaster: a toast with duration auto-dismisses", async () => {
  const host = body();
  const toaster = createToaster();
  render(toaster.host(), host);
  toaster.push({ message: "fleeting", duration: 10 });
  assert.equal(host.querySelectorAll(".dx-toast").length, 1);
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(host.querySelectorAll(".dx-toast").length, 0);
});

// --- Drawer ----------------------------------------------------------------
test("drawer: hidden when closed, visible + labelled when open, Esc closes", () => {
  const host = body();
  const open = signal(false);
  let closed = 0;
  render(
    drawer({
      open: () => open(),
      onClose: () => {
        closed++;
        open.set(false);
      },
      side: "left",
      title: "Filters",
      body: html`<p id="db">body</p>`,
      footer: html`<button id="df">Apply</button>`,
    }),
    host,
  );
  const root = host.querySelector(".dx-drawer-root")!;
  assert.ok(root.hasAttribute("hidden"));
  assert.ok(root.classList.contains("is-left"));

  open.set(true);
  assert.equal(root.hasAttribute("hidden"), false);
  assert.ok(root.classList.contains("is-open"));
  const panel = host.querySelector(".dx-drawer")!;
  assert.equal(panel.getAttribute("role"), "dialog");
  assert.equal(panel.getAttribute("aria-modal"), "true");
  assert.ok(panel.getAttribute("aria-labelledby"));
  assert.equal(host.querySelector("#db")!.textContent, "body");
  assert.ok(host.querySelector("#df"));

  // Escape on the root triggers onClose.
  key(root, "Escape");
  assert.equal(closed, 1);
  assert.ok(root.hasAttribute("hidden"));

  // Backdrop click also closes.
  open.set(true);
  fire(host.querySelector(".dx-drawer-backdrop")!, "click");
  assert.equal(closed, 2);
});

// --- Dropdown --------------------------------------------------------------
test("dropdown: opens on click, selecting an item fires onSelect and closes", () => {
  const host = body();
  let picked = "";
  render(
    dropdown({
      label: "Actions",
      items: [
        { label: "Edit", onSelect: () => (picked = "Edit") },
        { label: "Delete", danger: true, separator: true, onSelect: () => (picked = "Delete") },
        { label: "Archived", disabled: true, onSelect: () => (picked = "nope") },
      ],
    }),
    host,
  );
  const trigger = host.querySelector(".dx-dd-trigger")!;
  const menu = host.querySelector(".dx-menu")!;
  assert.equal(trigger.getAttribute("aria-haspopup"), "menu");
  assert.ok(menu.hasAttribute("hidden"));
  assert.equal(menu.getAttribute("role"), "menu");

  fire(trigger, "click");
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  assert.equal(menu.hasAttribute("hidden"), false);
  assert.equal(host.querySelectorAll(".dx-menu-item").length, 3);
  assert.ok(host.querySelector(".dx-menu-sep"));
  assert.ok(host.querySelector(".dx-menu-item.is-danger"));

  const edit = [...host.querySelectorAll(".dx-menu-item")].find((b) => b.textContent!.includes("Edit"))!;
  fire(edit, "click");
  assert.equal(picked, "Edit");
  assert.ok(menu.hasAttribute("hidden"));
});

test("dropdown: a disabled item does not fire; ArrowDown activates first enabled", () => {
  const host = body();
  let picked = "";
  render(
    dropdown({
      label: "Menu",
      items: [
        { label: "One", onSelect: () => (picked = "One") },
        { label: "Two", disabled: true, onSelect: () => (picked = "Two") },
        { label: "Three", onSelect: () => (picked = "Three") },
      ],
    }),
    host,
  );
  const root = host.querySelector(".dx-dd")!;
  // Clicking a disabled item does nothing.
  fire(host.querySelector(".dx-dd-trigger")!, "click");
  const two = [...host.querySelectorAll(".dx-menu-item")].find((b) => b.textContent!.includes("Two"))!;
  fire(two, "click");
  assert.equal(picked, "");

  // ArrowDown highlights the first ENABLED item (One); Enter fires it.
  key(root, "ArrowDown");
  assert.ok(host.querySelector(".dx-menu-item.is-active")!.textContent!.includes("One"));
  key(root, "ArrowDown"); // skip disabled Two → Three
  assert.ok(host.querySelector(".dx-menu-item.is-active")!.textContent!.includes("Three"));
  key(root, "Enter");
  assert.equal(picked, "Three");
});
