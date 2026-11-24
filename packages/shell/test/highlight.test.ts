import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { html, render } from "@dxjs/dom";
import { fuzzyMatch, createCommandPalette } from "../src/index.ts";

test("fuzzyMatch returns the matched character positions and a score", () => {
  const m = fuzzyMatch("Terminal", "term");
  assert.notEqual(m, null);
  assert.deepEqual(m!.positions, [0, 1, 2, 3], "contiguous match at the start");
  assert.ok(m!.score > 0);

  // Non-contiguous subsequence: "Go to Logs" ← "glg".
  const m2 = fuzzyMatch("Go to Logs", "glg");
  assert.deepEqual(
    m2!.positions.map((i) => "Go to Logs"[i]),
    ["G", "L", "g"],
    "positions point at the matched chars",
  );

  assert.equal(fuzzyMatch("Dashboard", "zz"), null, "non-match → null");
  assert.deepEqual(fuzzyMatch("x", ""), { score: 0, positions: [] }, "empty query → no positions");
});

test("palette view highlights the matched characters of a result title", () => {
  const p = createCommandPalette([{ id: "term", title: "Terminal", run: () => {} }]);
  p.show();
  const host = body();
  render(html`${() => p.view()}`, host);

  // No query → no highlight, full title shown as text.
  assert.equal(host.querySelectorAll(".dx-cmdk-hl").length, 0);
  assert.equal(host.querySelector(".dx-cmdk-item")!.textContent, "Terminal");

  // Query "term" → the leading "Term" is wrapped in a highlight, rest stays text.
  p.setQuery("term");
  const marks = [...host.querySelectorAll(".dx-cmdk-hl")];
  assert.ok(marks.length >= 1, "matched chars are highlighted");
  assert.equal(marks.map((m) => m.textContent).join(""), "Term", "exactly the matched chars");
  assert.equal(host.querySelector(".dx-cmdk-item")!.textContent, "Terminal", "whole title still reads correctly");

  // Clearing the query removes the highlight again (reactive).
  p.setQuery("");
  assert.equal(host.querySelectorAll(".dx-cmdk-hl").length, 0, "highlight cleared");
});
