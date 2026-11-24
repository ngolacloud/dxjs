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
// open cleanly (onopen), and records the URL it was opened with — enough to
// observe resume-on-reconnect and the backoff between failed reconnects.
class ResumableES {
  static instances: ResumableES[] = [];
  url: string;
  closed = false;
  readyState = 1;
  onerror: ((e: unknown) => void) | null = null;
  onopen: ((e: unknown) => void) | null = null;
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
  open(): void {
    this.onopen?.({});
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

// A hand-driven scheduler: it records every (delay) asked for and only runs a
// pending callback when the test flushes it — so backoff spacing is observable
// without real timers, and a cancelled wait is proved to never fire.
function manualScheduler() {
  const delays: number[] = [];
  let pending: (() => void) | null = null;
  const schedule = (fn: () => void, ms: number): (() => void) => {
    delays.push(ms);
    pending = fn;
    return () => {
      if (pending === fn) pending = null;
    };
  };
  const flush = (): boolean => {
    const fn = pending;
    pending = null;
    if (fn) fn();
    return fn !== null;
  };
  return { delays, schedule, flush, isPending: () => pending !== null };
}

test("resumes after reconnection without losing or duplicating folded deltas", () => {
  ResumableES.instances = [];
  const sched = manualScheduler();
  createRoot((dispose) => {
    const live = createLiveSource("/events", {
      EventSource: ResumableES as unknown as typeof EventSource,
      schedule: sched.schedule,
    });
    const total = live.signal<number>("delta", { initial: 0, fold: (p, d) => p + (d as number) });

    const first = ResumableES.instances[0];
    first.emit("1", "delta", "5");
    first.emit("2", "delta", "3");
    assert.equal(total(), 8);

    // Connection drops for good → the client schedules a backed-off reconnect,
    // then opens a FRESH EventSource carrying the stream cursor (we cannot set
    // the Last-Event-ID header by hand).
    first.fail();
    assert.equal(first.closed, true, "dead connection closed");
    assert.equal(ResumableES.instances.length, 1, "reconnect is deferred, not immediate");
    sched.flush(); // run the backoff timer
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

test("reconnect backoff grows between failures and gives up at the ceiling", () => {
  ResumableES.instances = [];
  const sched = manualScheduler();
  createRoot((dispose) => {
    const live = createLiveSource("/events", {
      EventSource: ResumableES as unknown as typeof EventSource,
      schedule: sched.schedule,
      reconnectBackoff: 100,
      maxReconnectDelay: 1000,
      maxReconnectAttempts: 3,
    });
    live.signal<number>("delta", { initial: 0 });

    // Each failure schedules the next reconnect; flushing it opens a new ES that
    // also fails — never opening — so the backoff keeps climbing. maxAttempts=3
    // means three reconnects are armed (delays 100,200,400), then we give up.
    ResumableES.instances[0].fail(); // arm reconnect #1
    assert.equal(ResumableES.instances.length, 1, "reconnect must wait for the timer");
    assert.equal(sched.delays.at(-1), 100, "first backoff = base");

    sched.flush();
    ResumableES.instances[1].fail(); // arm reconnect #2
    assert.equal(sched.delays.at(-1), 200, "second backoff doubled");

    sched.flush();
    ResumableES.instances[2].fail(); // arm reconnect #3
    assert.equal(sched.delays.at(-1), 400, "third backoff doubled again");

    sched.flush();
    ResumableES.instances[3].fail(); // ceiling reached → no reconnect #4

    // The attempt ceiling is hit: no further reconnect is armed, and no
    // tight-loop reopen happened (only the armed connections were ever made).
    assert.equal(sched.isPending(), false, "gave up — no further reconnect scheduled");
    assert.equal(ResumableES.instances.length, 4, "no reopen past the ceiling");
    assert.deepEqual(sched.delays, [100, 200, 400], "strictly increasing spacing, no apertado loop");

    dispose();
  });
});

test("a clean reopen resets the backoff ceiling for a later blip", () => {
  ResumableES.instances = [];
  const sched = manualScheduler();
  createRoot((dispose) => {
    const live = createLiveSource("/events", {
      EventSource: ResumableES as unknown as typeof EventSource,
      schedule: sched.schedule,
      reconnectBackoff: 100,
      maxReconnectAttempts: 2,
    });
    live.signal<number>("delta", { initial: 0 });

    ResumableES.instances[0].fail(); // attempt 1
    sched.flush();
    ResumableES.instances[1].open(); // recovered → counter resets
    ResumableES.instances[1].fail(); // a fresh blip starts backoff at the base again
    assert.equal(sched.delays.at(-1), 100, "backoff restarted from base after a clean open");

    dispose();
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
