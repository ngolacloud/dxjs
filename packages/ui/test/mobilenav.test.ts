import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { tabBar, fab } from "../src/mobilenav.ts";

const key = (el: Element, k: string): void =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

// --- tabBar ----------------------------------------------------------------
test("tabBar: tablist/tab roles, active is accented + aria-selected, badge bubble", () => {
  const host = body();
  const active = signal("home");
  render(
    tabBar({
      ariaLabel: "Primary",
      active: () => active(),
      onSelect: () => {},
      items: [
        { id: "home", label: "Home", icon: "home" },
        { id: "alerts", label: "Alerts", icon: "bell", badge: 3 },
        { id: "me", label: "Me", icon: "users" },
      ],
    }),
    host,
  );

  const bar = host.querySelector(".dx-tabbar")!;
  assert.equal(bar.getAttribute("role"), "tablist");
  assert.equal(bar.getAttribute("aria-label"), "Primary");

  const tabs = [...host.querySelectorAll(".dx-tabbar-item")];
  assert.equal(tabs.length, 3);
  assert.ok(tabs.every((t) => t.getAttribute("role") === "tab"));

  // Active tab reflects `active`.
  assert.equal(tabs[0].getAttribute("aria-selected"), "true");
  assert.ok(tabs[0].classList.contains("is-active"));
  assert.equal(tabs[1].getAttribute("aria-selected"), "false");

  // Badge bubble only where provided.
  assert.equal(host.querySelectorAll(".dx-tabbar-badge").length, 1);
  assert.equal(host.querySelector(".dx-tabbar-badge")!.textContent, "3");

  // Labels render visibly.
  assert.equal(tabs[0].querySelector(".dx-tabbar-label")!.textContent, "Home");
});

test("tabBar: clicking a tab reports its id; reactive active moves the accent", () => {
  const host = body();
  const active = signal("home");
  let picked = "";
  render(
    tabBar({
      active: () => active(),
      onSelect: (id) => {
        picked = id;
        active.set(id);
      },
      items: [
        { id: "home", label: "Home", icon: "home" },
        { id: "me", label: "Me", icon: "users" },
      ],
    }),
    host,
  );
  const tabs = [...host.querySelectorAll(".dx-tabbar-item")];

  fire(tabs[1], "click");
  assert.equal(picked, "me");
  // Reactivity is synchronous: the accent followed the signal.
  assert.ok(tabs[1].classList.contains("is-active"));
  assert.equal(tabs[1].getAttribute("aria-selected"), "true");
  assert.ok(!tabs[0].classList.contains("is-active"));
});

// --- fab (plain) -----------------------------------------------------------
test("fab: without actions it is a labelled button that fires onClick", () => {
  const host = body();
  let clicks = 0;
  render(fab({ label: "Compose", onClick: () => clicks++ }), host);

  const btn = host.querySelector(".dx-fab")!;
  assert.equal(btn.getAttribute("aria-label"), "Compose");
  // No menu semantics when there are no actions (false attr is omitted).
  assert.ok(!btn.hasAttribute("aria-haspopup"));
  assert.ok(!btn.hasAttribute("aria-expanded"));
  // Default glyph is the plus icon.
  assert.ok(host.querySelector(".dx-fab svg"));

  fire(btn, "click");
  assert.equal(clicks, 1);
  // No speed-dial exists.
  assert.equal(host.querySelectorAll(".dx-fab-dial").length, 0);
});

test("fab: position and tone become classes", () => {
  const host = body();
  render(fab({ label: "New", position: "bl", tone: "pos", onClick: () => {} }), host);
  assert.ok(host.querySelector(".dx-fab-root.is-bl"));
  assert.ok(host.querySelector(".dx-fab.is-pos"));
});

// --- fab (speed-dial) ------------------------------------------------------
test("fab: with actions, click toggles a labelled speed-dial; selecting fires + closes", () => {
  const host = body();
  let did = "";
  render(
    fab({
      label: "Create",
      actions: [
        { label: "New file", icon: "file-text", onClick: () => (did = "file") },
        { label: "New folder", icon: "folder", onClick: () => (did = "folder") },
      ],
    }),
    host,
  );

  const trigger = host.querySelector(".dx-fab")!;
  const dial = host.querySelector(".dx-fab-dial")!;
  assert.equal(trigger.getAttribute("aria-haspopup"), "menu");
  assert.equal(dial.getAttribute("role"), "menu");
  // Closed initially.
  assert.ok(dial.hasAttribute("hidden"));
  assert.equal(trigger.getAttribute("aria-expanded"), "false");

  // Each mini button is a labelled menuitem.
  const items = [...host.querySelectorAll(".dx-fab-action")];
  assert.equal(items.length, 2);
  assert.ok(items.every((b) => b.getAttribute("role") === "menuitem"));
  assert.equal(items[0].getAttribute("aria-label"), "New file");

  // Open.
  fire(trigger, "click");
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  assert.equal(dial.hasAttribute("hidden"), false);
  assert.ok(trigger.classList.contains("is-open"));

  // Selecting an action fires it and closes the dial.
  fire(items[1], "click");
  assert.equal(did, "folder");
  assert.ok(dial.hasAttribute("hidden"));
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
});

test("fab: Escape and focus leaving the root both close the dial", () => {
  const host = body();
  render(
    fab({
      label: "Create",
      actions: [{ label: "New file", icon: "file-text", onClick: () => {} }],
    }),
    host,
  );
  const root = host.querySelector(".dx-fab-root")!;
  const trigger = host.querySelector(".dx-fab")!;
  const dial = host.querySelector(".dx-fab-dial")!;

  // Escape closes.
  fire(trigger, "click");
  assert.equal(dial.hasAttribute("hidden"), false);
  key(root, "Escape");
  assert.ok(dial.hasAttribute("hidden"));

  // Focus leaving the root (relatedTarget outside) closes.
  fire(trigger, "click");
  assert.equal(dial.hasAttribute("hidden"), false);
  root.dispatchEvent(new Event("focusout", { bubbles: true }));
  assert.ok(dial.hasAttribute("hidden"));
});
