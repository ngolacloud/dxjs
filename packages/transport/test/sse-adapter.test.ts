import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot } from "@dxjs/core";
import {
  method, sseAdapter, composeTransport, inMemoryAdapter, liveSignal,
  type Transport,
} from "../src/index.ts";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const feed = method<{ topic: string }, { n: number }>({
  id: "feed.watch",
  kind: "serverStream",
  wire: { http: { path: "/events" } },
});

/** A fetch that returns a text/event-stream Response with the given body. */
function sseFetch(bodyText: string, status = 200): { fetch: typeof fetch; urls: string[] } {
  const urls: string[] = [];
  const fn = (async (url: string) => {
    urls.push(String(url));
    return new Response(status === 200 ? bodyText : "", {
      status,
      headers: { "content-type": "text/event-stream" },
    });
  }) as unknown as typeof fetch;
  return { fetch: fn, urls };
}

test("sseAdapter yields each event's JSON data; caps.serverStream is true", async () => {
  const { fetch: fn, urls } = sseFetch("data: {\"n\":1}\n\ndata: {\"n\":2}\n\ndata: {\"n\":3}\n\n");
  const t = sseAdapter({ baseUrl: "/v1", fetch: fn });
  assert.equal(t.caps.serverStream, true);

  const out: Array<{ n: number }> = [];
  for await (const v of t.serverStream(feed, { topic: "a" })) out.push(v);
  assert.deepEqual(out, [{ n: 1 }, { n: 2 }, { n: 3 }]);
  // path from wire.http + the request object folded into the query string
  assert.equal(urls[0], "/v1/events?topic=a");
});

test("sseAdapter handles multi-line data + CRLF frames + non-JSON events", async () => {
  const { fetch: fn } = sseFetch("data: line1\ndata: line2\r\n\r\ndata: {\"ok\":true}\n\n");
  const t = sseAdapter({ fetch: fn });
  const out: unknown[] = [];
  for await (const v of t.serverStream(feed, {})) out.push(v);
  assert.deepEqual(out, ["line1\nline2", { ok: true }]);
});

test("sseAdapter.unary throws (stream-only)", () => {
  const t = sseAdapter({ fetch: sseFetch("").fetch });
  assert.throws(() => t.unary(feed, {}), /stream-only/);
});

test("composeTransport routes unary to one adapter and serverStream to another", async () => {
  const get = method<{ id: number }, { id: number }>({ id: "x.get" });
  const unaryT = inMemoryAdapter({ handlers: { "x.get": (r: { id: number }) => ({ id: r.id }) } });
  const streamT = sseAdapter({ fetch: sseFetch("data: {\"n\":7}\n\n").fetch });
  const t: Transport = composeTransport(unaryT, streamT);

  assert.equal(t.caps.serverStream, true);
  assert.deepEqual(await t.unary(get, { id: 9 }), { id: 9 });
  const out: unknown[] = [];
  for await (const v of t.serverStream(feed, {})) out.push(v);
  assert.deepEqual(out, [{ n: 7 }]);
});

test("liveSignal prefers the SSE stream (value tracks the last pushed message)", async () => {
  const { fetch: fn } = sseFetch("data: {\"n\":10}\n\ndata: {\"n\":20}\n\n");
  const t = sseAdapter({ fetch: fn });
  await createRoot(async (dispose) => {
    const v = liveSignal<{ topic: string }, { n: number }>(t, feed, { topic: "a" });
    for (let i = 0; i < 6; i++) await tick();
    assert.deepEqual(v(), { n: 20 }, "signal holds the last streamed message");
    assert.equal(v.error(), undefined);
    dispose();
  });
});

test("sseAdapter reconnects and resumes with Last-Event-ID (and parses retry:)", async () => {
  const bodies = [
    "id: 1\ndata: {\"n\":1}\n\n",
    "retry: 5\nid: 2\ndata: {\"n\":2}\n\n",
    "id: 3\ndata: {\"n\":3}\n\n",
  ];
  const seenIds: Array<string | undefined> = [];
  let call = 0;
  const fn = (async (_url: string, init?: RequestInit) => {
    const h = (init?.headers ?? {}) as Record<string, string>;
    seenIds.push(h["last-event-id"]);
    const body = bodies[Math.min(call, bodies.length - 1)]!;
    call++;
    return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
  }) as unknown as typeof fetch;

  const t = sseAdapter({ fetch: fn, reconnect: true, retryMs: 1 });
  const ctrl = new AbortController();
  const out: Array<{ n: number }> = [];
  for await (const v of t.serverStream(feed, {}, { signal: ctrl.signal })) {
    out.push(v);
    if (out.length === 2) ctrl.abort(); // stop after the reconnect delivered #2
  }
  assert.deepEqual(out, [{ n: 1 }, { n: 2 }]);
  assert.equal(seenIds[0], undefined, "first connect sends no Last-Event-ID");
  assert.equal(seenIds[1], "1", "the reconnect resumes from the last id");
  assert.ok(call <= 2, "aborted before a third connect");
});

test("sseAdapter without reconnect ends when the stream ends (default)", async () => {
  const fn = (async () => new Response("data: {\"n\":1}\n\n", { headers: { "content-type": "text/event-stream" } })) as unknown as typeof fetch;
  const out: unknown[] = [];
  for await (const v of sseAdapter({ fetch: fn }).serverStream(feed, {})) out.push(v);
  assert.deepEqual(out, [{ n: 1 }], "finite stream terminates (no reconnect)");
});
