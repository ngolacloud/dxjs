// AUDIT PoC — H5 (ALTO): an effect that throws (with no onError boundary) aborts
// the whole flush and leaves the remaining effects permanently wedged (queued=true
// / state=DIRTY, so markStale/enqueue become no-ops and they never re-run). This
// test registers a throwing effect BEFORE a healthy one, both depending on the same
// signal so they share one flush; it asserts the healthy effect keeps reacting. It
// fails against the pre-fix scheduler and passes once H5 isolates errors per effect.
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal, effect, createRoot } from "../src/index.ts";

test("H5: an effect that throws must not freeze other effects in the same flush", () => {
  createRoot((dispose) => {
    const a = signal(0);
    let healthyRuns = 0;

    // Registered first → scheduled first in the flush queue.
    effect(() => {
      if (a() % 2 === 1) throw new Error("boom"); // throws on odd values
    });
    // Registered second → scheduled AFTER the thrower; depends on the same signal.
    effect(() => {
      a();
      healthyRuns++;
    });

    const baseline = healthyRuns; // ran once at creation

    // This write enqueues both effects; the first throws. Its (unhandled) error
    // propagates out of set() — catch it, that is expected.
    try {
      a.set(1);
    } catch {
      /* unhandled effect error — fine for this PoC */
    }

    // A later, unrelated write must still drive the healthy effect.
    try {
      a.set(2);
    } catch {
      /* the thrower no longer throws on an even value */
    }

    assert.ok(
      healthyRuns > baseline,
      `healthy effect must keep reacting after an unrelated effect threw ` +
        `(runs=${healthyRuns}, baseline=${baseline})`,
    );
    dispose();
  });
});
