import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fromAsyncIterable,
  fromEventTarget,
  fromWebSocket,
  fromEventSource,
  type StreamController,
} from "../src/sources.ts";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const noCtl: StreamController = { error() {}, done() {} };

test("fromAsyncIterable pulls to completion and reports done", async () => {
  async function* gen(): AsyncGenerator<number> {
    yield 1;
    yield 2;
    yield 3;
  }
  const got: number[] = [];
  let done = false;
  fromAsyncIterable(gen()).subscribe((i) => got.push(i), { error() {}, done: () => (done = true) });
  await tick();
  assert.deepEqual(got, [1, 2, 3]);
  assert.equal(done, true);
});

test("fromAsyncIterable: unsubscribe halts an otherwise endless source", async () => {
  let produced = 0;
  async function* endless(): AsyncGenerator<number> {
    for (;;) {
      produced++;
      yield produced;
      await new Promise((r) => setTimeout(r, 0)); // a macrotask between items
    }
  }
  const got: number[] = [];
  const unsub = fromAsyncIterable(endless()).subscribe((i) => got.push(i), noCtl);
  await tick();
  await tick();
  const n = got.length;
  assert.ok(n >= 1, "produced at least one item");
  unsub();
  await tick();
  await tick();
  assert.equal(got.length, n, "no pushes after unsubscribe");
});

test("fromAsyncIterable surfaces a thrown error via ctl.error", async () => {
  async function* boom(): AsyncGenerator<number> {
    yield 1;
    throw new Error("kaboom");
  }
  const got: number[] = [];
  let err: unknown;
  fromAsyncIterable(boom()).subscribe((i) => got.push(i), { error: (e) => (err = e), done() {} });
  await tick();
  assert.deepEqual(got, [1]);
  assert.match(String((err as Error).message), /kaboom/);
});

test("fromEventTarget maps events; unsubscribe removes the listener", () => {
  const target = new EventTarget();
  const got: string[] = [];
  const unsub = fromEventTarget<string>(target, "ping", (ev) => (ev as CustomEvent<string>).detail).subscribe(
    (i) => got.push(i),
    noCtl,
  );
  target.dispatchEvent(new CustomEvent("ping", { detail: "a" }));
  assert.deepEqual(got, ["a"]);
  unsub();
  target.dispatchEvent(new CustomEvent("ping", { detail: "b" }));
  assert.deepEqual(got, ["a"], "no more events after unsubscribe");
});

// --- Injected fake WebSocket -------------------------------------------------

class FakeWebSocket {
  static last: FakeWebSocket | undefined;
  url: string;
  protocols: string | string[] | undefined;
  sent: string[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(url: string, protocols?: string | string[]) {
    this.url = url;
    this.protocols = protocols;
    FakeWebSocket.last = this;
  }
  send(data: string): void {
    this.sent.push(data);
  }
  close(): void {
    this.closed = true;
  }
}

test("fromWebSocket: sends open frame, parses messages, done on close, closes on unsubscribe", () => {
  const got: number[] = [];
  let done = false;
  const unsub = fromWebSocket<number>("ws://x", {
    WebSocket: FakeWebSocket as unknown as typeof WebSocket,
    open: { sub: "orders" },
    parse: (raw) => Number(raw),
  }).subscribe((i) => got.push(i), { error() {}, done: () => (done = true) });

  const ws = FakeWebSocket.last!;
  ws.onopen!();
  assert.equal(ws.sent[0], JSON.stringify({ sub: "orders" }), "open frame sent as JSON");

  ws.onmessage!({ data: "1" });
  ws.onmessage!({ data: "2" });
  assert.deepEqual(got, [1, 2]);

  ws.onclose!();
  assert.equal(done, true, "close reported as done");

  unsub(); // already terminal after onclose: a no-op, no second close
  assert.equal(ws.closed, false, "socket not re-closed after a server close");
});

test("fromWebSocket: unsubscribe closes a still-open socket", () => {
  const unsub = fromWebSocket<number>("ws://x", {
    WebSocket: FakeWebSocket as unknown as typeof WebSocket,
  }).subscribe(() => {}, noCtl);
  const ws = FakeWebSocket.last!;
  ws.onopen!();
  assert.equal(ws.closed, false);
  unsub();
  assert.equal(ws.closed, true, "unsubscribe closes the live socket");
});

test("fromWebSocket: default parser is JSON with raw-string fallback; error reported", () => {
  const got: unknown[] = [];
  let err: unknown;
  fromWebSocket<unknown>("ws://x", { WebSocket: FakeWebSocket as unknown as typeof WebSocket }).subscribe(
    (i) => got.push(i),
    { error: (e) => (err = e), done() {} },
  );
  const ws = FakeWebSocket.last!;
  ws.onmessage!({ data: '{"a":1}' });
  ws.onmessage!({ data: "not-json" });
  assert.deepEqual(got, [{ a: 1 }, "not-json"]);
  ws.onerror!();
  assert.match(String((err as Error).message), /WebSocket error/);
});

// --- Injected fake EventSource -----------------------------------------------

class FakeEventSource {
  static last: FakeEventSource | undefined;
  url: string;
  closed = false;
  // EventSource.readyState: CONNECTING(0) | OPEN(1) | CLOSED(2). A transient drop
  // fires 'error' while CONNECTING; only CLOSED is terminal.
  readyState = 0;
  private listeners = new Map<string, Set<(ev: unknown) => void>>();
  constructor(url: string) {
    this.url = url;
    FakeEventSource.last = this;
  }
  addEventListener(event: string, handler: (ev: unknown) => void): void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(handler);
  }
  removeEventListener(event: string, handler: (ev: unknown) => void): void {
    this.listeners.get(event)?.delete(handler);
  }
  close(): void {
    this.closed = true;
    this.readyState = 2;
  }
  emit(event: string, data: string): void {
    this.listeners.get(event)?.forEach((h) => h({ data }));
  }
  emitError(): void {
    this.listeners.get("error")?.forEach((h) => h({}));
  }
  get listenerCount(): number {
    let n = 0;
    for (const s of this.listeners.values()) n += s.size;
    return n;
  }
}

test("fromEventSource: parses named events; ctl.error on error; unsubscribe closes & unbinds", () => {
  const got: Array<{ n: number }> = [];
  let err: unknown;
  const unsub = fromEventSource<{ n: number }>("http://x", {
    EventSource: FakeEventSource as unknown as new (url: string) => EventSource,
    event: "tick",
  }).subscribe((i) => got.push(i), { error: (e) => (err = e), done() {} });

  const es = FakeEventSource.last!;
  es.emit("tick", JSON.stringify({ n: 1 }));
  es.emit("tick", JSON.stringify({ n: 2 }));
  assert.deepEqual(got, [{ n: 1 }, { n: 2 }]);

  es.readyState = 2; // CLOSED → this error is terminal
  es.emitError();
  assert.match(String((err as Error).message), /EventSource error/);

  unsub();
  assert.equal(es.closed, true);
  assert.equal(es.listenerCount, 0, "listeners removed on unsubscribe");
  es.emit("tick", JSON.stringify({ n: 3 }));
  assert.equal(got.length, 2, "no delivery after unsubscribe");
});

test("fromEventSource: a transient error (readyState CONNECTING) does NOT terminate the feed", () => {
  const got: number[] = [];
  let err: unknown;
  const unsub = fromEventSource<number>("http://x", {
    EventSource: FakeEventSource as unknown as new (url: string) => EventSource,
    event: "tick",
    parse: (raw) => Number(raw),
  }).subscribe((i) => got.push(i), { error: (e) => (err = e), done() {} });

  const es = FakeEventSource.last!;
  es.emit("tick", "1");

  // Server blip: EventSource fires 'error' while auto-reconnecting (CONNECTING).
  es.readyState = 0;
  es.emitError();
  assert.equal(err, undefined, "transient error is ignored — feed stays alive");

  // Reconnected: events keep flowing (would be impossible had we closed the source).
  es.emit("tick", "2");
  assert.deepEqual(got, [1, 2], "ingestion continued through the reconnect");

  unsub();
});
