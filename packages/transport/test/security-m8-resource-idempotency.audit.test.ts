// Security regression PoC — M8 (2026-11-25 audit): resource() retried its fetcher on
// failure with NO idempotency gate, asymmetric with the REST client (which refuses to
// replay a non-idempotent method). A fetcher with side effects (a POST) configured
// with `retries` would be executed multiple times on failure — a double write.
// The fix gates retries on `idempotent`: `idempotent:false` suppresses them.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot } from "@dxjs/core";
import { resource } from "../src/index.ts";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

test("M8: idempotent:false runs a failing fetcher exactly once (no retry replay)", async () => {
  await createRoot(async (dispose) => {
    let calls = 0;
    const r = resource(
      async () => {
        calls += 1;
        throw new Error("boom");
      },
      { retries: 3, idempotent: false },
    );
    // Let the (single) attempt and its rejection settle.
    for (let i = 0; i < 6; i++) await tick();
    assert.equal(calls, 1, "a non-idempotent fetcher must not be replayed");
    assert.equal(r.loading(), false);
    assert.ok(r.error() instanceof Error);
    dispose();
  });
});

test("M8: the idempotent default still retries (retries:2 → 3 attempts)", async () => {
  await createRoot(async (dispose) => {
    let calls = 0;
    const r = resource(
      async () => {
        calls += 1;
        throw new Error("boom");
      },
      { retries: 2 }, // backoff defaults to 0 → next-tick retries
    );
    for (let i = 0; i < 10; i++) await tick();
    assert.equal(calls, 3, "1 initial + 2 retries when idempotent (default)");
    assert.ok(r.error() instanceof Error);
    dispose();
  });
});

test("M8: explicit idempotent:true behaves like the default (retries honoured)", async () => {
  await createRoot(async (dispose) => {
    let calls = 0;
    resource(
      async () => {
        calls += 1;
        throw new Error("boom");
      },
      { retries: 1, idempotent: true },
    );
    for (let i = 0; i < 8; i++) await tick();
    assert.equal(calls, 2, "1 initial + 1 retry");
    dispose();
  });
});
