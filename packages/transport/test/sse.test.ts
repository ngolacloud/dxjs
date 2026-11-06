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
