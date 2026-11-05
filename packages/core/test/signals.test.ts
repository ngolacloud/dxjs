import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signal,
  computed,
  effect,
  batch,
  untrack,
  onCleanup,
  createRoot,
} from "../src/index.ts";

test("signal: read, set, update, peek", () => {
  const n = signal(1);
  assert.equal(n(), 1);
  assert.equal(n.set(2), 2);
  assert.equal(n(), 2);
  assert.equal(n.update((p) => p + 10), 12);
  assert.equal(n((p) => p + 1), 13); // callable updater form
  assert.equal(n(20), 20); // callable literal form
  assert.equal(n.peek(), 20);
});

test("computed: derives and memoises (no recompute without dep change)", () => {
  const a = signal(2);
  let runs = 0;
  const double = computed(() => {
    runs++;
    return a() * 2;
  });
  assert.equal(double(), 4);
  assert.equal(double(), 4); // cached
  assert.equal(runs, 1);
  a.set(3);
  assert.equal(double(), 6);
  assert.equal(runs, 2);
});

test("computed: unrelated signal change does not recompute", () => {
  const a = signal(1);
  const b = signal(99);
  let runs = 0;
  const c = computed(() => {
    runs++;
    return a() + 1;
  });
  c();
  b.set(100); // c does not depend on b
  c();
  assert.equal(runs, 1);
});

test("effect: runs on create and on dependency change", () => {
  const a = signal(0);
  const seen: number[] = [];
  const dispose = effect(() => seen.push(a()));
  assert.deepEqual(seen, [0]);
  a.set(1);
  a.set(2);
  assert.deepEqual(seen, [0, 1, 2]);
  dispose();
});

test("effect: dynamic dependencies unsubscribe the untaken branch", () => {
  const cond = signal(true);
  const a = signal("a");
  const b = signal("b");
  const seen: string[] = [];
  const dispose = effect(() => seen.push(cond() ? a() : b()));
  assert.deepEqual(seen, ["a"]);
  b.set("b2"); // not a dependency yet → no run
  assert.deepEqual(seen, ["a"]);
  cond.set(false); // now depends on b, not a
  assert.deepEqual(seen, ["a", "b2"]);
  a.set("a2"); // a is no longer a dependency → no run
  assert.deepEqual(seen, ["a", "b2"]);
  b.set("b3");
  assert.deepEqual(seen, ["a", "b2", "b3"]);
  dispose();
});

test("glitch-free: effect does not run when a computed's value is unchanged", () => {
  const n = signal(0);
  const parity = computed(() => n() % 2); // 0 or 1
  let runs = 0;
  const dispose = effect(() => {
    parity();
    runs++;
  });
  assert.equal(runs, 1);
  n.set(2); // 0 -> 0 parity unchanged
  assert.equal(runs, 1, "effect must not run when parity is unchanged");
  n.set(3); // parity 1 -> change
  assert.equal(runs, 2);
  dispose();
});

test("diamond: effect runs once per update (no duplicate)", () => {
  const a = signal(1);
  const b = computed(() => a() + 1);
  const c = computed(() => a() + 2);
  let runs = 0;
  const dispose = effect(() => {
    b();
    c();
    runs++;
  });
  assert.equal(runs, 1);
  a.set(2); // both b and c change from one source
  assert.equal(runs, 2, "diamond must not double-run the effect");
  dispose();
});

test("batch: multiple writes trigger a single effect flush", () => {
  const a = signal(0);
  const b = signal(0);
  let runs = 0;
  const dispose = effect(() => {
    a();
    b();
    runs++;
  });
  assert.equal(runs, 1);
  batch(() => {
    a.set(1);
    b.set(1);
    a.set(2);
  });
  assert.equal(runs, 2, "batch coalesces to one run");
  dispose();
});

test("untrack: reads do not create a dependency", () => {
  const a = signal(1);
  const b = signal(1);
  let runs = 0;
  const dispose = effect(() => {
    a();
    untrack(() => b());
    runs++;
  });
  assert.equal(runs, 1);
  b.set(2); // untracked → no run
  assert.equal(runs, 1);
  a.set(2);
  assert.equal(runs, 2);
  dispose();
});

test("onCleanup: runs before re-run and on dispose", () => {
  const a = signal(0);
  const log: string[] = [];
  const dispose = effect(() => {
    const v = a();
    onCleanup(() => log.push("cleanup:" + v));
  });
  a.set(1); // cleanup for 0 before re-run
  assert.deepEqual(log, ["cleanup:0"]);
  dispose(); // cleanup for 1 on dispose
  assert.deepEqual(log, ["cleanup:0", "cleanup:1"]);
});

test("effect: a returned function is used as cleanup", () => {
  const a = signal(0);
  const log: string[] = [];
  const dispose = effect(() => {
    const v = a();
    return () => log.push("ret-cleanup:" + v);
  });
  a.set(1);
  assert.deepEqual(log, ["ret-cleanup:0"]);
  dispose();
  assert.deepEqual(log, ["ret-cleanup:0", "ret-cleanup:1"]);
});

test("createRoot: dispose tears down everything (deterministic teardown)", () => {
  const a = signal(0);
  const seen: number[] = [];
  let cleaned = false;
  let runs = 0;
  const dispose = createRoot((dispose) => {
    effect(() => {
      seen.push(a());
      runs++;
      onCleanup(() => {
        cleaned = true;
      });
    });
    return dispose;
  });
  assert.equal(runs, 1);
  a.set(1);
  assert.equal(runs, 2);
  dispose();
  assert.ok(cleaned, "cleanups ran on dispose");
  a.set(2); // after dispose the effect must be dead
  assert.equal(runs, 2, "disposed effect must not run again");
  assert.deepEqual(seen, [0, 1]);
});

test("createRoot: nested effects/computeds are disposed with the root", () => {
  const a = signal(1);
  let innerRuns = 0;
  const dispose = createRoot((dispose) => {
    const c = computed(() => a() * 2);
    effect(() => {
      c();
      innerRuns++;
    });
    return dispose;
  });
  assert.equal(innerRuns, 1);
  a.set(2);
  assert.equal(innerRuns, 2);
  dispose();
  a.set(3);
  assert.equal(innerRuns, 2, "nested effect disposed with root");
});

test("equals:false forces notification even for equal values", () => {
  const a = signal(1, { equals: false });
  let runs = 0;
  const dispose = effect(() => {
    a();
    runs++;
  });
  assert.equal(runs, 1);
  a.set(1); // same value, but equals:false
  assert.equal(runs, 2);
  dispose();
});

test("custom equals controls change detection", () => {
  const a = signal({ id: 1, label: "x" }, { equals: (p, n) => p.id === n.id });
  let runs = 0;
  const dispose = effect(() => {
    a();
    runs++;
  });
  assert.equal(runs, 1);
  a.set({ id: 1, label: "y" }); // same id → no notify
  assert.equal(runs, 1);
  a.set({ id: 2, label: "y" }); // different id → notify
  assert.equal(runs, 2);
  dispose();
});
