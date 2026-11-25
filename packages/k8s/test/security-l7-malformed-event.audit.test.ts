// AUDIT PoC — L7: createResourceStore.apply trusted the event shape
//   (`e.object.metadata.uid`). A malformed event in a batch (null object, missing
//   metadata, bad type) threw and aborted the WHOLE batch, dropping the valid
//   events alongside it. Asserts the SAFE behaviour: malformed events are skipped,
//   valid ones in the same batch still apply (red pre-fix: apply throws).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createResourceStore, type K8sObject, type WatchEvent } from "../src/index.ts";

const pod = (name: string, uid: string, rv: string): K8sObject => ({
  kind: "Pod",
  metadata: { name, uid, resourceVersion: rv },
});

test("L7: a malformed event is skipped, the valid events in the batch still apply", () => {
  const store = createResourceStore();
  const batch = [
    { type: "ADDED", object: pod("good-1", "u1", "10") },
    { type: "ADDED", object: null },                       // malformed: no object
    { type: "MODIFIED", object: { metadata: {} } },        // malformed: no uid
    { type: "WHoops", object: pod("x", "u9", "11") },      // malformed: bad type
    { type: "ADDED", object: pod("good-2", "u2", "12") },
  ] as unknown as WatchEvent[];

  assert.doesNotThrow(() => store.apply(batch), "a malformed event must not abort the batch");
  assert.deepEqual(
    store.list().map((p) => p.metadata.name).sort(),
    ["good-1", "good-2"],
    "both valid events applied; malformed ones skipped",
  );
});

test("L7: a single malformed event is a no-op (does not throw)", () => {
  const store = createResourceStore();
  assert.doesNotThrow(() => store.apply({ type: "ADDED", object: undefined } as unknown as WatchEvent));
  assert.equal(store.list().length, 0);
});
