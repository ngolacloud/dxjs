import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { component, mount } from "@dxjs/component";
import { createLogViewer, type LogLine } from "../src/index.ts";

const line = (ts: number, source: string, level: LogLine["level"], text: string): LogLine => ({ ts, source, level, text });

test("merges multiple sources in time order", () => {
  const lv = createLogViewer();
  lv.append([line(30, "api", "info", "c"), line(10, "db", "info", "a")]);
  lv.append(line(20, "api", "info", "b"));
  assert.deepEqual(lv.lines().map((l) => l.text), ["a", "b", "c"], "ordered by ts across sources");
  assert.deepEqual(lv.sources(), ["api", "db"], "distinct sources tracked");
});

test("filters by min level, active sources and text query (reactively)", () => {
  const lv = createLogViewer();
  lv.append([
    line(1, "api", "debug", "noise"),
    line(2, "api", "info", "hello world"),
    line(3, "db", "warn", "slow query"),
    line(4, "db", "error", "boom"),
  ]);
  assert.equal(lv.lines().length, 4);

  lv.setMinLevel("warn");
  assert.deepEqual(lv.lines().map((l) => l.text), ["slow query", "boom"], "min level drops debug/info");

  lv.setMinLevel("debug");
  lv.setSources(["db"]);
  assert.deepEqual(lv.lines().map((l) => l.source), ["db", "db"], "only active source");

  lv.setSources(null);
  lv.setQuery("WORLD");
  assert.deepEqual(lv.lines().map((l) => l.text), ["hello world"], "case-insensitive text filter");

  lv.setQuery("");
  assert.equal(lv.lines().length, 4, "clearing the query restores all");
});

test("ring buffer caps retained lines", () => {
  const lv = createLogViewer({ maxLines: 3 });
  for (let i = 0; i < 10; i++) lv.append(line(i, "api", "info", `m${i}`));
  assert.deepEqual(lv.lines().map((l) => l.text), ["m7", "m8", "m9"]);
});

test("virtualizes: thousands of lines render only a viewport window of nodes", () => {
  const host = body();
  const lv = createLogViewer({ height: 300, rowHeight: 20 }); // ~15 visible + overscan
  const many: LogLine[] = [];
  for (let i = 0; i < 5000; i++) many.push(line(i, i % 2 ? "api" : "db", "info", `log ${i}`));
  lv.append(many);

  const App = component(() => lv.view());
  mount(App, host, {});

  const rows = host.querySelectorAll(".dx-log-row").length;
  assert.ok(rows > 0, "some rows rendered");
  assert.ok(rows < 60, `only a window of rows in the DOM, got ${rows} (not 5000)`);
  // The first visible row is the earliest line (scrollTop 0).
  assert.equal(host.querySelector(".dx-log-txt")!.textContent, "log 0");
});
