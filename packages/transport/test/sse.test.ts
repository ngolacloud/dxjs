import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot } from "@dxjs/core";
import { createLiveSource } from "../src/index.ts";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  listeners: Record<string, Array<(e: unknown) => void>> = {};
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, h: (e: unknown) => void): void {
    (this.listeners[type] ||= []).push(h);
  }
  removeEventListener(type: string, h: (e: unknown) => void): void {
    this.listeners[type] = (this.listeners[type] || []).filter((x) => x !== h);
  }
  emit(type: string, data: string): void {
    for (const h of this.listeners[type] || []) h({ data });
  }
  close(): void {
    this.closed = true;
  }
}

test("one shared connection multiplexes many topics; signals update on events", () => {
  FakeEventSource.instances = [];
  createRoot((dispose) => {
    const live = createLiveSource("/events", { EventSource: FakeEventSource as unknown as typeof EventSource });
    const price = live.signal<number>("ticker:AO", { initial: 0 });
    const status = live.signal<string>("node:health", { initial: "unknown" });
    assert.equal(FakeEventSource.instances.length, 1, "a single shared EventSource");

    const es = FakeEventSource.instances[0];
    es.emit("ticker:AO", "1234");
    es.emit("node:health", '"ok"');
    assert.equal(price(), 1234);
    assert.equal(status(), "ok");
    dispose();
  });
});

test("connection closes when the last topic unsubscribes", () => {
  FakeEventSource.instances = [];
  const dispose = createRoot((d) => {
    const live = createLiveSource("/events", { EventSource: FakeEventSource as unknown as typeof EventSource });
    live.signal<number>("a", { initial: 0 });
    live.signal<number>("b", { initial: 0 });
    return d;
  });
  const es = FakeEventSource.instances[0];
  assert.equal(es.closed, false);
  dispose(); // tears down both topics
  assert.equal(es.closed, true, "idle connection closed");
});

test("fold accumulates deltas (real-feed pattern)", () => {
  FakeEventSource.instances = [];
  createRoot((dispose) => {
    const live = createLiveSource("/events", { EventSource: FakeEventSource as unknown as typeof EventSource });
    const total = live.signal<number>("delta", {
      initial: 0,
      fold: (prev, d) => prev + (d as number),
    });
    const es = FakeEventSource.instances[0];
    es.emit("delta", "5");
    es.emit("delta", "3");
    assert.equal(total(), 8, "deltas folded into a running total");
    dispose();
  });
});

// A fake that carries event ids, can fail for good (readyState CLOSED + onerror),
// and records the URL it was opened with — enough to observe resume-on-reconnect.
class ResumableES {
  static instances: ResumableES[] = [];
  url: string;
  closed = false;
  readyState = 1;
  onerror: ((e: unknown) => void) | null = null;
  listeners: Record<string, Array<(e: unknown) => void>> = {};
  constructor(url: string) {
    this.url = url;
    ResumableES.instances.push(this);
  }
  addEventListener(type: string, h: (e: unknown) => void): void {
    (this.listeners[type] ||= []).push(h);
  }
  removeEventListener(type: string, h: (e: unknown) => void): void {
    this.listeners[type] = (this.listeners[type] || []).filter((x) => x !== h);
  }
  emit(id: string, type: string, data: string): void {
    for (const h of this.listeners[type] || []) h({ lastEventId: id, data });
  }
  fail(): void {
    this.readyState = 2; // CLOSED → the client must reopen with the resume cursor
    this.onerror?.({});
  }
  close(): void {
    this.closed = true;
  }
}

test("resumes after reconnection without losing or duplicating folded deltas", () => {
  ResumableES.instances = [];
  createRoot((dispose) => {
    const live = createLiveSource("/events", { EventSource: ResumableES as unknown as typeof EventSource });
    const total = live.signal<number>("delta", { initial: 0, fold: (p, d) => p + (d as number) });

    const first = ResumableES.instances[0];
    first.emit("1", "delta", "5");
    first.emit("2", "delta", "3");
    assert.equal(total(), 8);

    // Connection drops for good → the client opens a FRESH EventSource carrying
    // the stream cursor (we cannot set the Last-Event-ID header by hand).
    first.fail();
    assert.equal(first.closed, true, "dead connection closed");
    assert.equal(ResumableES.instances.length, 2, "reconnected with a new EventSource");
    const second = ResumableES.instances[1];
    assert.match(second.url, /[?&]lastEventId=2\b/, "resume cursor carried in the URL");

    // The resuming server redelivers the cursor event (id 2) then the one we
    // missed (id 3). The duplicate must NOT fold twice; the missed one MUST land.
    second.emit("2", "delta", "3"); // duplicate of the cursor — ignored
    second.emit("3", "delta", "2"); // genuinely new — folded
    assert.equal(total(), 10, "no lost and no duplicated increment across reconnect");

    dispose();
    assert.equal(second.closed, true, "connection closed on dispose");
  });
});

test("malformed frame is ignored (keeps last good value)", () => {
  FakeEventSource.instances = [];
  createRoot((dispose) => {
    const live = createLiveSource("/events", { EventSource: FakeEventSource as unknown as typeof EventSource });
    const v = live.signal<number>("t", { initial: 7 });
    const es = FakeEventSource.instances[0];
    es.emit("t", "not json{");
    assert.equal(v(), 7);
    es.emit("t", "9");
    assert.equal(v(), 9);
    dispose();
  });
});
