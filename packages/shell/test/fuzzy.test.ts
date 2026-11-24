import { test } from "node:test";
import assert from "node:assert/strict";
import { fuzzyScore, createCommandPalette } from "../src/index.ts";

test("fuzzyScore: subsequence matching (non-contiguous) and non-matches", () => {
  // "glg" is a subsequence of "Go to Logs" (G…L…g) but not contiguous.
  assert.notEqual(fuzzyScore("Go to Logs", "glg"), null);
  // Not a subsequence → no match.
  assert.equal(fuzzyScore("Go to Logs", "xyz"), null);
  assert.equal(fuzzyScore("Dashboard", "zz"), null);
  // Empty query matches everything (score 0).
  assert.equal(fuzzyScore("anything", ""), 0);
});

test("fuzzyScore: contiguous/word-boundary beats a scattered match", () => {
  // Same query, two texts. "Terminal" matches term as a whole word from the
  // start; "the random image" only as a scattered subsequence.
  const contiguous = fuzzyScore("Terminal", "term");
  const scattered = fuzzyScore("the random image", "term");
  assert.notEqual(contiguous, null);
  assert.notEqual(scattered, null);
  assert.ok(contiguous > scattered, `contiguous (${contiguous}) should outrank scattered (${scattered})`);
});

test("fuzzyScore: a word-boundary substring beats the same substring mid-word", () => {
  const atBoundary = fuzzyScore("Go Logs", "log"); // "log" starts the word "Logs"
  const midWord = fuzzyScore("Catalog", "log"); // "log" sits inside "cataLOG"
  assert.ok(atBoundary > midWord, `boundary (${atBoundary}) should outrank mid-word (${midWord})`);
});

test("palette ranks the stronger match first and keeps substring queries working", () => {
  const noop = () => {};
  const p = createCommandPalette([
    { id: "a", title: "Go to Terminal", run: noop },
    { id: "b", title: "Terminal", run: noop },
  ]);
  p.show();
  p.setQuery("term");
  assert.deepEqual(
    p.results().map((c) => c.id),
    ["b", "a"],
    "the whole-word match ('Terminal') ranks above the scattered one",
  );

  // Fuzzy subsequence still finds a command plain substring would miss.
  const p2 = createCommandPalette([
    { id: "logs", title: "Go to Logs", run: noop },
    { id: "prefs", title: "User preferences", run: noop },
  ]);
  p2.setQuery("glg");
  assert.deepEqual(p2.results().map((c) => c.id), ["logs"], "'glg' uniquely matches 'Go to Logs'");

  // A substring query is a subset of fuzzy (back-compat with the old behaviour).
  p2.setQuery("prefer");
  assert.deepEqual(p2.results().map((c) => c.id), ["prefs"]);
  p2.setQuery("zzz");
  assert.equal(p2.results().length, 0, "no matches → empty");
});
