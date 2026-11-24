import { body } from "../../../packages/dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountApp } from "../src/app.ts";

const hist = () => (globalThis as { history: History }).history;
const doc = () => (globalThis as { document: Document }).document;
const navClick = (host: Element, label: string): void => {
  const btn = [...host.querySelectorAll(".dx-nav-item")].find((b) => b.textContent!.includes(label))!;
  btn.dispatchEvent(new (globalThis as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent("click", { bubbles: true }));
};

test("Cloud Shell: nested router switches pages with live panels", () => {
  hist().replaceState(null, "", "/");
  const host = body();
  const dispose = mountApp(host);

  // Shell + dashboard (the default route) with live data.
  assert.equal(host.querySelector(".dx-brand")!.textContent, "dxjs Cloud");
  assert.equal(host.querySelectorAll(".dx-nav-item").length, 4);
  assert.ok(host.querySelector(".dx-stat"), "dashboard statGrid rendered");
  const podsTile = [...host.querySelectorAll(".dx-stat")].find((s) => s.textContent!.includes("PODS"))!;
  assert.ok(podsTile.textContent!.includes("2"), "live pod count from the store");

  // → Terminal
  navClick(host, "Terminal");
  assert.ok(host.querySelector(".dx-term"), "terminal mounted");
  assert.ok(host.querySelector(".dx-term-out")!.textContent!.includes("Welcome to the dxjs Cloud Shell"));

  // → Logs (virtualized viewer with rows)
  navClick(host, "Logs");
  assert.ok(host.querySelector(".dx-vlist"), "virtualized log list mounted");
  assert.ok(host.querySelectorAll(".dx-log-row").length > 0, "log rows rendered");

  // → Resources (k8s explorer table with the demo pods)
  navClick(host, "Resources");
  const names = [...host.querySelectorAll("tbody tr td:first-child")].map((td) => td.textContent);
  assert.ok(names.includes("web-7f9") && names.includes("api-2c4"), "pods listed live");

  dispose();
});

test("Cloud Shell: Ctrl-K opens the palette, a command navigates, topbar toggles theme", () => {
  hist().replaceState(null, "", "/");
  const root = doc().documentElement;
  const host = body();
  const dispose = mountApp(host);

  // Theme starts dark (controller applied on creation); topbar toggles it.
  assert.equal(root.getAttribute("data-theme"), "dark");
  const themeBtn = host.querySelector(".cs-theme")!;
  themeBtn.dispatchEvent(new (globalThis as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent("click", { bubbles: true }));
  assert.equal(root.getAttribute("data-theme"), "light", "topbar toggled the theme");

  // ⌘K / Ctrl-K opens the command palette (global keydown).
  const palette = host.querySelector(".dx-cmdk")!;
  assert.equal(palette.hasAttribute("hidden"), true, "palette hidden initially");
  doc().dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true }));
  assert.equal(palette.hasAttribute("hidden"), false, "Ctrl-K opened the palette");

  // Running a command navigates and closes the palette.
  const item = [...host.querySelectorAll(".dx-cmdk-item")].find((li) => li.textContent!.includes("Go to Logs"))!;
  item.dispatchEvent(new (globalThis as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent("click", { bubbles: true }));
  assert.ok(host.querySelector(".dx-vlist"), "command navigated to the Logs page");
  assert.equal(palette.hasAttribute("hidden"), true, "palette closed after running a command");

  dispose();
});
