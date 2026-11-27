import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html, render } from "@dxjs/dom";
import { bottomSheet, actionSheet } from "../src/sheet.ts";

const key = (el: Element, k: string): void =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

// --- Bottom sheet ----------------------------------------------------------
test("bottomSheet: hidden when closed, visible + labelled when open, grab handle present", () => {
  const host = body();
  const open = signal(false);
  render(
    bottomSheet({
      open: () => open(),
      onClose: () => open.set(false),
      title: "Details",
      body: html`<p id="sb">body text</p>`,
      footer: html`<button id="sf">Save</button>`,
    }),
    host,
  );
  const root = host.querySelector(".dx-sheet-root")!;
  assert.ok(root.hasAttribute("hidden"));
  assert.equal(root.classList.contains("is-open"), false);

  open.set(true);
  assert.equal(root.hasAttribute("hidden"), false);
  assert.ok(root.classList.contains("is-open"));

  const panel = host.querySelector(".dx-sheet")!;
  assert.equal(panel.getAttribute("role"), "dialog");
  assert.equal(panel.getAttribute("aria-modal"), "true");
  assert.ok(panel.getAttribute("aria-labelledby"));
  assert.ok(host.querySelector(".dx-sheet-grab"));
  assert.equal(host.querySelector(".dx-sheet-title")!.textContent, "Details");
  assert.equal(host.querySelector("#sb")!.textContent, "body text");
  assert.ok(host.querySelector("#sf"));
});

test("bottomSheet: Escape and a backdrop click both close", () => {
  const host = body();
  const open = signal(true);
  let closed = 0;
  render(
    bottomSheet({
      open: () => open(),
      onClose: () => {
        closed++;
        open.set(false);
      },
      body: "hi",
    }),
    host,
  );
  const root = host.querySelector(".dx-sheet-root")!;
  key(root, "Escape");
  assert.equal(closed, 1);
  assert.ok(root.hasAttribute("hidden"));

  open.set(true);
  fire(host.querySelector(".dx-sheet-backdrop")!, "click");
  assert.equal(closed, 2);
});

test("bottomSheet: no title means no header and no aria-labelledby", () => {
  const host = body();
  render(bottomSheet({ open: true, body: "plain" }), host);
  assert.equal(host.querySelector(".dx-sheet-head"), null);
  assert.equal(host.querySelector(".dx-sheet")!.hasAttribute("aria-labelledby"), false);
});

// --- Action sheet ----------------------------------------------------------
test("actionSheet: renders a menu of actions; selecting fires onSelect then closes", () => {
  const host = body();
  const open = signal(true);
  let picked = "";
  let closed = 0;
  render(
    actionSheet({
      open: () => open(),
      onClose: () => {
        closed++;
        open.set(false);
      },
      title: "Choose",
      actions: [
        { label: "Share", icon: "upload", onSelect: () => (picked = "Share") },
        { label: "Delete", icon: "trash", danger: true, onSelect: () => (picked = "Delete") },
        { label: "Archived", disabled: true, onSelect: () => (picked = "nope") },
      ],
    }),
    host,
  );
  const dock = host.querySelector(".dx-as-dock")!;
  assert.equal(dock.getAttribute("role"), "menu");
  assert.ok(host.querySelector(".dx-as-grab"));
  assert.equal(host.querySelectorAll(".dx-as-item").length, 3);
  assert.ok(host.querySelector(".dx-as-item.is-danger"));
  assert.equal(host.querySelector(".dx-as-title")!.textContent, "Choose");

  const share = [...host.querySelectorAll(".dx-as-item")].find((b) => b.textContent!.includes("Share"))!;
  fire(share, "click");
  assert.equal(picked, "Share");
  assert.equal(closed, 1);
  assert.ok(host.querySelector(".dx-as-root")!.hasAttribute("hidden"));
});

test("actionSheet: a disabled action does not fire or close", () => {
  const host = body();
  let picked = "";
  let closed = 0;
  render(
    actionSheet({
      open: true,
      onClose: () => closed++,
      actions: [{ label: "Archived", disabled: true, onSelect: () => (picked = "nope") }],
    }),
    host,
  );
  const disabled = host.querySelector(".dx-as-item")!;
  assert.ok(disabled.hasAttribute("disabled"));
  fire(disabled, "click");
  assert.equal(picked, "");
  assert.equal(closed, 0);
});

test("actionSheet: cancel row and Escape close; default cancel label is Cancel", () => {
  const host = body();
  const open = signal(true);
  let closed = 0;
  render(
    actionSheet({
      open: () => open(),
      onClose: () => {
        closed++;
        open.set(false);
      },
      actions: [{ label: "Only", onSelect: () => {} }],
    }),
    host,
  );
  const cancel = host.querySelector(".dx-as-cancel")!;
  assert.equal(cancel.textContent, "Cancel");
  fire(cancel, "click");
  assert.equal(closed, 1);

  open.set(true);
  key(host.querySelector(".dx-as-root")!, "Escape");
  assert.equal(closed, 2);
});

test("actionSheet: hidden when closed; is-open toggles with open", () => {
  const host = body();
  const open = signal(false);
  render(actionSheet({ open: () => open(), actions: [{ label: "X" }] }), host);
  const root = host.querySelector(".dx-as-root")!;
  assert.ok(root.hasAttribute("hidden"));
  assert.equal(root.classList.contains("is-open"), false);
  open.set(true);
  assert.equal(root.hasAttribute("hidden"), false);
  assert.ok(root.classList.contains("is-open"));
});
