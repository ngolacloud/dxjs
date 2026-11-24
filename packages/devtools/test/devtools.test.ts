import { test } from "node:test";
import assert from "node:assert/strict";
import { signal, computed, effect } from "@dxjs/core";
import { createDevtools } from "../src/index.ts";

test("devtools captures signals/computeds/effects, values and run counts", () => {
  const dev = createDevtools();
  try {
    const n = signal(0, { name: "count" });
    const double = computed(() => n() * 2, { name: "double" });
    let runs = 0;
    effect(() => {
      double();
      runs++;
    }, "log");

    const byName = (nm: string) => dev.nodes().find((x) => x.name === nm)!;
    assert.equal(byName("count").kind, "signal");
    assert.equal(byName("double").kind, "computed");
    assert.equal(byName("log").kind, "effect");

    // Initial run: computed produced 0, effect ran once.
    assert.equal(byName("double").value, 0);
    assert.equal(byName("log").runs, 1);

    // A write propagates: signal value, computed value + a recompute, effect re-run.
    n.set(5);
    assert.equal(byName("count").value, 5);
    assert.equal(byName("double").value, 10);
    assert.ok(byName("double").runs >= 1, "computed recomputed");
    assert.equal(byName("log").runs, 2, "effect re-ran once on the write");
    assert.equal(runs, 2);
  } finally {
    dev.stop();
  }
});

test("devtools tracks disposal and live() filters it out", () => {
  const dev = createDevtools();
  try {
    const stop = effect(() => {}, "temp");
    assert.ok(dev.live().some((n) => n.name === "temp"), "effect is live");
    stop();
    assert.equal(dev.nodes().find((n) => n.name === "temp")!.disposed, true, "marked disposed");
    assert.ok(!dev.live().some((n) => n.name === "temp"), "excluded from live()");
  } finally {
    dev.stop();
  }
});

test("no instrumentation after stop() (zero-cost path restored)", () => {
  const dev = createDevtools();
  dev.stop();
  const before = dev.nodes().length;
  // Created with no inspector installed → not captured anywhere.
  const s = signal(1, { name: "ghost" });
  s.set(2);
  assert.equal(dev.nodes().length, before, "nothing captured once stopped");
  assert.ok(!dev.nodes().some((n) => n.name === "ghost"));
});
