import "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { effect } from "@dxjs/core";
import { createThemeController } from "../src/index.ts";

const root = () => (globalThis as { document: Document }).document.documentElement;

test("createThemeController writes/removes data-theme and is reactive", () => {
  root().removeAttribute("data-theme");
  const tc = createThemeController("light");
  assert.equal(root().getAttribute("data-theme"), "light", "initial applied to the root");
  assert.equal(tc.theme(), "light");

  // Reactive: an effect observing theme() re-runs on change.
  const seen: string[] = [];
  const stop = effect(() => seen.push(tc.theme()));
  assert.deepEqual(seen, ["light"]);

  tc.setTheme("dark");
  assert.equal(root().getAttribute("data-theme"), "dark");
  assert.equal(seen.at(-1), "dark", "theme signal updated");

  // "system" removes the attribute (OS preference wins).
  tc.setTheme("system");
  assert.equal(root().getAttribute("data-theme"), null, "system clears the override");
  assert.equal(tc.theme(), "system");
  stop();
});

test("toggle flips light↔dark", () => {
  root().removeAttribute("data-theme");
  const tc = createThemeController("light");
  tc.toggle();
  assert.equal(tc.theme(), "dark");
  assert.equal(root().getAttribute("data-theme"), "dark");
  tc.toggle();
  assert.equal(tc.theme(), "light");
  assert.equal(root().getAttribute("data-theme"), "light");
});
