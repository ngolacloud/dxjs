// Security regression PoC — M9 (2026-11-25 audit): wsAdapter.auth was accepted but
// silently ignored ("reserved for a future slice"), so an app that configured a
// credential still opened an UNAUTHENTICATED subscription — a false sense of security
// and a CSWSH risk. The fix transmits the credential as the first frame on open,
// before the request, so the server can authenticate the stream.

import { test } from "node:test";
import assert from "node:assert/strict";
import { method } from "../src/port.ts";
import { wsAdapter } from "../src/ws.ts";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const feed = method<{ topic: string }, { n: number }>({ id: "feed.watch", kind: "serverStream" });

/** A fake WebSocket that records the frames sent and opens on a microtask. */
class FakeWS {
  static instances: FakeWS[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  readyState = 0;
  sent: string[] = [];
  constructor(_url: string, _protocols?: string | string[]) {
    FakeWS.instances.push(this);
    queueMicrotask(() => {
      this.readyState = 1;
      this.onopen?.({});
    });
  }
  send(d: string): void {
    this.sent.push(d);
  }
  close(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    this.onclose?.({});
  }
}

/** Drive the stream until the socket opens, run `check` against the sent frames,
 *  then close cleanly so the generator ends and leaves no pending handles. */
async function withOpenSocket(
  t: ReturnType<typeof wsAdapter>,
  topic: string,
  check: (sent: string[]) => void,
): Promise<void> {
  FakeWS.instances.length = 0;
  const it = t.serverStream(feed, { topic })[Symbol.asyncIterator]();
  const first = it.next(); // start iterating so the generator wires the socket
  await tick(); // let the socket open on its microtask
  const ws = FakeWS.instances[0]!;
  check(ws.sent);
  ws.close();
  await first;
}

test("M9: a configured credential is sent as the auth frame before the request", async () => {
  const t = wsAdapter({
    url: "wss://x/feed",
    WebSocket: FakeWS as unknown as typeof WebSocket,
    auth: () => "s3cr3t",
  });
  await withOpenSocket(t, "a", (sent) => {
    assert.equal(sent.length, 2, "auth frame + request frame");
    assert.deepEqual(JSON.parse(sent[0]!), { type: "authorization", authorization: "Bearer s3cr3t" });
    assert.deepEqual(JSON.parse(sent[1]!), { topic: "a" }, "request follows the auth frame");
  });
});

test("M9: with no credential, only the request frame is sent (no empty auth frame)", async () => {
  const t = wsAdapter({ url: "wss://x/feed", WebSocket: FakeWS as unknown as typeof WebSocket });
  await withOpenSocket(t, "b", (sent) => {
    assert.equal(sent.length, 1, "only the request frame");
    assert.deepEqual(JSON.parse(sent[0]!), { topic: "b" });
  });
});

test("M9: an empty/falsy credential is treated as absent (no auth frame)", async () => {
  const t = wsAdapter({
    url: "wss://x/feed",
    WebSocket: FakeWS as unknown as typeof WebSocket,
    auth: () => "",
  });
  await withOpenSocket(t, "c", (sent) => {
    assert.equal(sent.length, 1);
    assert.deepEqual(JSON.parse(sent[0]!), { topic: "c" });
  });
});
