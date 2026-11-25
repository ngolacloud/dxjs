// Security regression PoC — M7 (2026-11-25 audit): streams without a resource limit.
// The SSE reader accumulated bytes into `buf` while waiting for a frame boundary
// (`\n\n`). A server that streams forever without ever closing a frame would grow
// that buffer unbounded and exhaust client memory. The fix caps the unterminated
// buffer and aborts the stream once it is exceeded.

import { test } from "node:test";
import assert from "node:assert/strict";
import { method, sseAdapter } from "../src/index.ts";

const feed = method<Record<string, never>, unknown>({
  id: "feed.watch",
  kind: "serverStream",
  wire: { http: { path: "/events" } },
});

test("M7: an unterminated SSE frame is bounded (does not grow forever)", async () => {
  // 200 bytes with no `\n\n` boundary, cap set to 32.
  const fn = (async () =>
    new Response("x".repeat(200), {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    })) as unknown as typeof fetch;
  const t = sseAdapter({ fetch: fn, maxBufferBytes: 32 });

  await assert.rejects(
    async () => {
      for await (const _ of t.serverStream(feed, {})) void _;
    },
    /exceeded 32 bytes/i,
  );
});

test("M7: a normal framed stream under the cap is unaffected (no false positive)", async () => {
  const fn = (async () =>
    new Response('data: {"n":1}\n\ndata: {"n":2}\n\n', {
      status: 200,
      headers: { "content-type": "text/event-stream" },
    })) as unknown as typeof fetch;
  const t = sseAdapter({ fetch: fn, maxBufferBytes: 1024 });

  const out: unknown[] = [];
  for await (const v of t.serverStream(feed, {})) out.push(v);
  assert.deepEqual(out, [{ n: 1 }, { n: 2 }]);
});
