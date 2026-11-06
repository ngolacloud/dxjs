import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot, signal } from "@dxjs/core";
import { resource } from "../src/index.ts";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

test("resolves: loading flips, data lands", async () => {
  await createRoot(async (dispose) => {
    const r = resource(async () => {
      await tick();
      return 42;
    });
    assert.equal(r.loading(), true);
    assert.equal(r(), undefined);
    await tick();
    await tick();
    assert.equal(r.loading(), false);
    assert.equal(r(), 42);
    dispose();
  });
});

test("refetches when a tracked signal changes", async () => {
  await createRoot(async (dispose) => {
    const id = signal(1);
    let seen = 0;
    const r = resource(async () => {
      const cur = id(); // tracked
      seen++;
      await tick();
      return "user:" + cur;
    });
    await tick();
    await tick();
    assert.equal(r(), "user:1");
    id.set(2);
    await tick();
    await tick();
    assert.equal(r(), "user:2");
    assert.equal(seen, 2);
    dispose();
  });
});

test("stale response cannot overwrite a newer one", async () => {
  await createRoot(async (dispose) => {
    const id = signal(1);
    const delays: Record<number, number> = { 1: 40, 2: 5 };
    const r = resource(async (sig) => {
      const cur = id();
      await new Promise((res) => setTimeout(res, delays[cur]));
      if (sig.aborted) throw new Error("aborted");
      return cur;
    });
    id.set(2); // supersede #1 before it resolves
    await new Promise((res) => setTimeout(res, 60));
    assert.equal(r(), 2, "the latest request wins even though #1 resolved later");
    dispose();
  });
});

test("dispose aborts the in-flight request", async () => {
  let abortedSeen = false;
  await createRoot(async (dispose) => {
    resource(async (sig) => {
      sig.addEventListener("abort", () => {
        abortedSeen = true;
      });
      await new Promise((res) => setTimeout(res, 50));
      return 1;
    });
    await tick();
    dispose();
  });
  assert.equal(abortedSeen, true);
});
