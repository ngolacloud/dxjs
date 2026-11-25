import { test } from "node:test";
import assert from "node:assert/strict";
import { method } from "../src/port.ts";
import { wsAdapter } from "../src/ws.ts";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const feed = method<{ topic: string }, { n: number }>({
  id: "feed.watch",
  kind: "serverStream",
});

/** A fake WebSocket: no real server. It opens on a microtask (like the real one),
 *  records what was sent, and lets a test drive messages/close/error. */
class FakeWS {
  static instances: FakeWS[] = [];
  onopen: ((ev: unknown) => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: ((ev: unknown) => void) | null = null;
  onerror: ((ev: unknown) => void) | null = null;
  readyState = 0;
  sent: string[] = [];
  url: string;
  protocols?: string | string[];
  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
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
  emit(obj: unknown): void {
    this.onmessage?.({ data: JSON.stringify(obj) });
  }
  emitRaw(data: string): void {
    this.onmessage?.({ data });
  }
  fail(): void {
    this.onerror?.({});
  }
}

function makeAdapter(): { t: ReturnType<typeof wsAdapter> } {
  FakeWS.instances.length = 0;
  const t = wsAdapter({ url: "wss://x/feed", WebSocket: FakeWS as unknown as typeof WebSocket });
  return { t };
}

test("wsAdapter sends the request as JSON on open", async () => {
  const { t } = makeAdapter();
  const it = t.serverStream(feed, { topic: "a" })[Symbol.asyncIterator]();
  const first = it.next(); // start iterating so the generator wires the socket
  await tick(); // let the socket open on its microtask
  const ws = FakeWS.instances[0]!;
  assert.equal(ws.sent.length, 1);
  assert.deepEqual(JSON.parse(ws.sent[0]!), { topic: "a" });
  ws.close();
  await first;
});

test("wsAdapter yields emitted messages parsed as JSON", async () => {
  const { t } = makeAdapter();
  const out: Array<{ n: number }> = [];
  const run = (async () => {
    for await (const v of t.serverStream(feed, { topic: "a" })) out.push(v);
  })();
  await tick(); // socket open
  const ws = FakeWS.instances[0]!;
  ws.emit({ n: 1 });
  ws.emit({ n: 2 });
  await tick();
  ws.close();
  await run;
  assert.deepEqual(out, [{ n: 1 }, { n: 2 }]);
});

test("wsAdapter yields a non-JSON frame as the raw string", async () => {
  const { t } = makeAdapter();
  const out: unknown[] = [];
  const run = (async () => {
    for await (const v of t.serverStream(feed, {})) out.push(v);
  })();
  await tick();
  const ws = FakeWS.instances[0]!;
  ws.emitRaw("not-json");
  await tick();
  ws.close();
  await run;
  assert.deepEqual(out, ["not-json"]);
});

test("aborting ctx.signal closes the socket and ends the stream", async () => {
  const { t } = makeAdapter();
  const ctrl = new AbortController();
  const out: unknown[] = [];
  const run = (async () => {
    for await (const v of t.serverStream(feed, {}, { signal: ctrl.signal })) out.push(v);
  })();
  await tick();
  const ws = FakeWS.instances[0]!;
  ws.emit({ n: 1 });
  await tick();
  ctrl.abort();
  await run;
  assert.equal(ws.readyState, 3, "socket was closed on abort");
  assert.deepEqual(out, [{ n: 1 }]);
});

test("wsAdapter throws on a socket error", async () => {
  const { t } = makeAdapter();
  const run = (async () => {
    for await (const _v of t.serverStream(feed, {})) {
      /* drain */
    }
  })();
  await tick();
  const ws = FakeWS.instances[0]!;
  ws.fail();
  await assert.rejects(run, /WebSocket error/);
});

test("wsAdapter.unary throws (stream-only)", () => {
  const { t } = makeAdapter();
  assert.throws(() => t.unary(feed, {}), /stream-only/);
});

test("wsAdapter caps: serverStream and bidi are true", () => {
  const { t } = makeAdapter();
  assert.equal(t.caps.serverStream, true);
  assert.equal(t.caps.bidi, true);
  assert.equal(t.caps.binary, false);
  assert.equal(t.caps.inProcess, false);
});
