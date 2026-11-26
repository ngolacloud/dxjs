// Security regression PoC — M6 (2026-11-25 audit): the SSE adapter let the server
// control the reconnect backoff. A hostile/misconfigured server that answers with a
// `retry:0` line and then immediately ends the stream drove the client into a tight
// reconnect loop (sleep(0) → fetch → close → sleep(0) → …), burning CPU and hammering
// the endpoint. The fix clamps the server `retry:` to [minRetryMs, maxRetryMs] and
// floors every backoff wait, so reconnection stays bounded no matter what the server says.

import { test } from "node:test";
import assert from "node:assert/strict";
import { method, sseAdapter } from "../src/index.ts";

const feed = method<Record<string, never>, { n: number }>({
  id: "feed.watch",
  kind: "serverStream",
  wire: { http: { path: "/events" } },
});

/** A fetch that always returns a stream carrying `retry:0` and then closing — the
 *  malicious shape. Counts how many times it is dialled. */
function retryZeroFetch(): { fetch: typeof fetch; count: () => number } {
  let n = 0;
  const fn = (async () => {
    n += 1;
    return new Response("retry:0\n\n", {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    });
  }) as unknown as typeof fetch;
  return { fetch: fn, count: () => n };
}

test("M6: a `retry:0` server cannot drive a tight reconnect loop", async () => {
  const { fetch: fn, count } = retryZeroFetch();
  // minRetryMs == maxRetryMs == 25 → a fixed, floored 25ms wait (no jitter spread).
  const t = sseAdapter({ fetch: fn, reconnect: true, minRetryMs: 25, maxRetryMs: 25 });

  const ac = new AbortController();
  // Wide enough that a loaded event loop (full suite in parallel) still fits one
  // 25ms floored wait; the upper bound below scales with the time that actually
  // elapsed, so the window size does not weaken the hot-loop check.
  const WINDOW = 400;
  const started = performance.now();
  const stop = setTimeout(() => ac.abort(), WINDOW);
  try {
    // The stream never yields data; the loop just reconnects until we abort.
    for await (const _ of t.serverStream(feed, {}, { signal: ac.signal })) void _;
  } finally {
    clearTimeout(stop);
  }
  const elapsed = performance.now() - started;

  const dials = count();
  // Floored at 25ms, at most one dial per 25ms elapsed (+ the initial dial and
  // one of slack) — never a hot loop. Without the floor (sleep(0)), this count
  // would be in the hundreds/thousands.
  const ceiling = Math.floor(elapsed / 25) + 2;
  assert.ok(dials >= 2, `should have reconnected at least once (got ${dials})`);
  assert.ok(dials <= ceiling, `reconnect must stay bounded, not hot-loop (got ${dials} in ${Math.round(elapsed)}ms, ceiling ${ceiling})`);
});

test("M6: minRetryMs defaults keep a server retry:0 from meaning zero", async () => {
  // Same shape but relying on defaults (min 250ms): in a 160ms window the client
  // should dial at most twice (initial + maybe one reconnect), never a flood.
  const { fetch: fn, count } = retryZeroFetch();
  const t = sseAdapter({ fetch: fn, reconnect: true });

  const ac = new AbortController();
  const stop = setTimeout(() => ac.abort(), 160);
  try {
    for await (const _ of t.serverStream(feed, {}, { signal: ac.signal })) void _;
  } finally {
    clearTimeout(stop);
  }
  assert.ok(count() <= 3, `default floor must prevent a flood (got ${count()})`);
});
