// AUDIT PoC — L6: when an effect throws AFTER creating child nodes and the error
//   is HANDLED by an onError boundary, the children created during the failed run
//   must be disposed. Before the fix they were left live (orphaned): subscribed to
//   their own deps, re-running forever, leaking — until a parent re-run that may
//   never come. Asserts the orphan is gone (does not re-run on its own dep).
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal, effect, createRoot, onError } from "../src/index.ts";

test("L6: a handled throwing effect disposes the children it created", () => {
  const childDep = signal(0);
  let childRuns = 0;
  let handled = 0;

  createRoot(() => {
    onError(() => {
      handled++;
    });
    effect(() => {
      // Create a child effect that subscribes to childDep (runs synchronously),
      // THEN throw — the child is an orphan of a failed run.
      effect(() => {
        childDep();
        childRuns++;
      });
      throw new Error("boom");
    });
  });

  assert.equal(handled, 1, "the throw was routed to the boundary");
  const afterInitial = childRuns; // the child ran once while subscribing
  childDep.set(1); // an orphaned (live) child would re-run here
  assert.equal(childRuns, afterInitial, "the disposed child does not re-run on its dep");
});
