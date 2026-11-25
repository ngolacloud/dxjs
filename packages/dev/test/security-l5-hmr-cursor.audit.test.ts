// AUDIT PoC — L5: the HMR long-poll read `since = Number(param)` (NaN for "abc")
//   and had no waiter cap. A NaN cursor mis-cursors updatesSince and holds the
//   socket for the full window; unbounded waiters pin open sockets. Asserts: an
//   invalid cursor is answered immediately with the current epoch, and the waiter
//   pool is capped (the over-cap request returns 204 instead of being held).
// Run with --test-force-exit: the capped holds keep 25s timers alive by design.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDevServer } from "../src/server.ts";

function server() {
  const app = mkdtempSync(join(tmpdir(), "dxjs-l5-"));
  writeFileSync(join(app, "entry.ts"), "export {}\n");
  return { srv: createDevServer({ entry: join(app, "entry.ts"), root: app }), app };
}
const hmr = (q: string): Request =>
  new Request("http://localhost/@dx/hmr" + q, { headers: { host: "localhost" } });

test("L5: an invalid `since` is answered immediately with the current epoch", async () => {
  const { srv, app } = server();
  try {
    for (const q of ["?since=abc", "?since=-5", "?since=NaN"]) {
      // Pre-fix each HOLDS for 25s (Number → NaN, `epoch > NaN` is false).
      const res = await srv.handler(hmr(q));
      assert.equal(res.status, 200, `${q} must answer immediately, got ${res.status}`);
      const body = (await res.json()) as { epoch: number; updates: unknown[] };
      assert.equal(body.epoch, 0);
      assert.deepEqual(body.updates, []);
    }
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
});

test("L5: the long-poll waiter pool is capped (over-cap → 204, not held)", async () => {
  const { srv, app } = server();
  try {
    // Fill the pool: since=0 with epoch=0 holds. Do NOT await these (they hang 25s).
    const held: Array<Promise<Response>> = [];
    for (let i = 0; i < 256; i++) held.push(srv.handler(hmr("?since=0")));
    // The next request is over MAX_WAITERS → must return immediately (204).
    const over = await srv.handler(hmr("?since=0"));
    assert.equal(over.status, 204, "over-cap long-poll is not held");
    void held; // intentionally left pending; --test-force-exit tears them down
  } finally {
    rmSync(app, { recursive: true, force: true });
  }
});
