import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { gantt, barGeom } from "../src/gantt.ts";

test("barGeom: percentages of the day-range", () => {
  // range 2026-01-01..2026-01-11 is a 10-day span; task 01-03..01-05.
  const g = barGeom("2026-01-01", "2026-01-11", "2026-01-03", "2026-01-05");
  assert.ok(Math.abs(g.x - 20) < 1e-9, `x≈20, got ${g.x}`);
  assert.ok(Math.abs(g.width - 20) < 1e-9, `width≈20, got ${g.width}`);

  // a bar flush to the start has x=0; full-range bar has width=100.
  const full = barGeom("2026-01-01", "2026-01-11", "2026-01-01", "2026-01-11");
  assert.equal(full.x, 0);
  assert.equal(full.width, 100);
});

test("gantt: renders one bar per task with the right geometry", () => {
  const host = body();
  render(
    gantt({
      start: "2026-01-01",
      end: "2026-01-11",
      tasks: [
        { id: "a", label: "Design", start: "2026-01-01", end: "2026-01-03", tone: "info" },
        { id: "b", label: "Build", start: "2026-01-03", end: "2026-01-07", progress: 50 },
        { id: "c", label: "Ship", start: "2026-01-09", end: "2026-01-11", tone: "pos" },
      ],
    }),
    host,
  );
  const bars = host.querySelectorAll(".dx-gantt-bar");
  assert.equal(bars.length, 3, "one bar per task");
  // task b starts at day 2 of 10 → x=20, width=40.
  const bBar = bars[1]!;
  assert.equal(bBar.getAttribute("x"), "20");
  assert.equal(bBar.getAttribute("width"), "40");
  // progress rect present for b, width = 40 * 50/100 = 20.
  assert.equal(host.querySelectorAll(".dx-gantt-prog").length, 1);
  assert.equal(host.querySelector(".dx-gantt-prog")!.getAttribute("width"), "20");
  // axis ticks render.
  assert.ok(host.querySelectorAll(".dx-gantt-tick").length > 0);
});

test("gantt: reactive task list updates the bars", () => {
  const host = body();
  const tasks = signal([{ id: "a", label: "One", start: "2026-02-01", end: "2026-02-03" }]);
  render(gantt({ start: "2026-02-01", end: "2026-02-05", tasks: () => tasks() }), host);
  assert.equal(host.querySelectorAll(".dx-gantt-bar").length, 1);
  tasks.set([
    { id: "a", label: "One", start: "2026-02-01", end: "2026-02-03" },
    { id: "b", label: "Two", start: "2026-02-03", end: "2026-02-05" },
  ]);
  assert.equal(host.querySelectorAll(".dx-gantt-bar").length, 2);
});
