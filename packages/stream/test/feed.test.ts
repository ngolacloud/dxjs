import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot, effect } from "@dxjs/core";
import { streamFeed } from "../src/feed.ts";
import type { StreamSource, StreamController } from "../src/sources.ts";

// Drain the microtask queue AFTER the feed's queued flush microtask (which was
// enqueued first on push), then a macrotask hop for async-iterable sources.
const micro = (): Promise<void> => new Promise((r) => queueMicrotask(r));
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

/** A hand-driven StreamSource: the test pushes/errors/dones directly. */
function manualSource<T>() {
  let sink: (item: T) => void = () => {};
  let controller: StreamController = { error() {}, done() {} };
  let unsubscribed = false;
  const src: StreamSource<T> = {
    subscribe(s, c) {
      sink = s;
      controller = c;
      return () => {
        unsubscribed = true;
      };
    },
  };
  return {
    src,
    push: (item: T): void => sink(item),
    error: (e: unknown): void => controller.error(e),
    done: (): void => controller.done(),
    get unsubscribed(): boolean {
      return unsubscribed;
    },
  };
}

test("batching: N rapid pushes land in ONE visible change; lastBatch has all N", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<number>();
    const feed = streamFeed<number>({ source: m.src });
    let changes = 0;
    effect(() => {
      feed.items(); // subscribe
      changes++;
    });
    assert.equal(changes, 1, "effect runs once on creation");

    m.push(1);
    m.push(2);
    m.push(3);
    assert.deepEqual(feed.items(), [], "not reflected before the flush tick");

    await micro();
    assert.deepEqual(feed.items(), [1, 2, 3]);
    assert.deepEqual(feed.lastBatch(), [1, 2, 3]);
    assert.equal(feed.size(), 3);
    assert.equal(changes, 2, "the whole batch produced exactly one visible change");
    dispose();
  });
});

test("items() returns a fresh array reference per changing flush", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<number>();
    const feed = streamFeed<number>({ source: m.src });
    m.push(1);
    await micro();
    const a = feed.items();
    m.push(2);
    await micro();
    const b = feed.items();
    assert.notEqual(a, b, "a new reference so signal equality notifies");
    assert.deepEqual(a, [1]);
    assert.deepEqual(b, [1, 2]);
    dispose();
  });
});

test("coalescing: pushes to one key collapse to the latest value, ordered by `order`", async () => {
  type Row = { id: number; seq: number; v: string };
  await createRoot(async (dispose) => {
    const m = manualSource<Row>();
    const feed = streamFeed<Row, number>({
      source: m.src,
      key: (x) => x.id,
      order: (a, b) => a.seq - b.seq,
    });
    m.push({ id: 1, seq: 1, v: "a" });
    m.push({ id: 1, seq: 2, v: "b" });
    m.push({ id: 1, seq: 3, v: "c" });
    m.push({ id: 2, seq: 1, v: "z" });
    await micro();

    const rows = feed.items();
    assert.equal(rows.length, 2, "one entry per key");
    // ordered by seq ascending: id 2 (seq 1) then id 1 (latest seq 3)
    assert.deepEqual(
      rows.map((r) => [r.id, r.v]),
      [
        [2, "z"],
        [1, "c"],
      ],
    );
    dispose();
  });
});

test("window: ring buffer keeps the newest N and counts evictions as dropped", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<number>();
    const feed = streamFeed<number>({ source: m.src, window: 3 });
    for (let i = 1; i <= 5; i++) m.push(i);
    await micro();
    assert.deepEqual(feed.items(), [3, 4, 5], "oldest evicted from the front");
    assert.equal(feed.dropped(), 2);
    dispose();
  });
});

test("backpressure drop-newest: rejects incoming once pending is full", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<number>();
    const feed = streamFeed<number>({ source: m.src, backpressure: { max: 2, policy: "drop-newest" } });
    m.push(1);
    m.push(2);
    m.push(3); // rejected
    m.push(4); // rejected
    assert.equal(feed.dropped(), 2, "drops counted immediately, pre-flush");
    await micro();
    assert.deepEqual(feed.items(), [1, 2]);
    dispose();
  });
});

test("backpressure drop-oldest: evicts the front to admit the newcomer", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<number>();
    const feed = streamFeed<number>({ source: m.src, backpressure: { max: 2, policy: "drop-oldest" } });
    m.push(1);
    m.push(2);
    m.push(3); // evicts 1
    m.push(4); // evicts 2
    assert.equal(feed.dropped(), 2);
    await micro();
    assert.deepEqual(feed.items(), [3, 4]);
    dispose();
  });
});

test("backpressure bounded: keeps the newest max (== drop-oldest on pending)", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<number>();
    const feed = streamFeed<number>({ source: m.src, backpressure: { max: 2, policy: "bounded" } });
    m.push(1);
    m.push(2);
    m.push(3);
    m.push(4);
    assert.equal(feed.dropped(), 2);
    await micro();
    assert.deepEqual(feed.items(), [3, 4]);
    dispose();
  });
});

test("pause collects without reflecting; resume flushes; clear empties; dropped survives clear", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<number>();
    const feed = streamFeed<number>({ source: m.src, paused: true, window: 2 });
    assert.equal(feed.paused(), true);

    m.push(1);
    m.push(2);
    m.push(3); // 3 pushed while paused; window 2 applies on flush
    await micro();
    assert.deepEqual(feed.items(), [], "paused: nothing reflected");

    feed.resume();
    assert.equal(feed.paused(), false);
    assert.deepEqual(feed.items(), [2, 3], "resume flushes immediately; window kept newest 2");
    assert.equal(feed.dropped(), 1, "the windowed-out item counted");

    feed.clear();
    assert.deepEqual(feed.items(), []);
    assert.equal(feed.dropped(), 1, "clear does not reset dropped");

    m.push(4);
    await micro();
    assert.deepEqual(feed.items(), [4], "normal cadence resumed after clear");
    dispose();
  });
});

test("stop(): unsubscribes the source and a late push is a no-op; idempotent", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<number>();
    const feed = streamFeed<number>({ source: m.src });
    m.push(1);
    await micro();
    assert.deepEqual(feed.items(), [1]);

    feed.stop();
    assert.equal(m.unsubscribed, true, "source unsubscribed");
    m.push(2); // late
    await micro();
    assert.deepEqual(feed.items(), [1], "late push ignored after stop");
    feed.stop(); // idempotent — must not throw
    dispose();
  });
});

test("done(): folds the tail then stops", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<number>();
    const feed = streamFeed<number>({ source: m.src });
    m.push(1);
    m.push(2);
    m.done(); // should flush the pending tail synchronously then release
    assert.deepEqual(feed.items(), [1, 2], "tail folded on done");
    assert.equal(m.unsubscribed, true);
    dispose();
  });
});

test("synchronous terminal during subscribe() still releases the source's unsubscribe", async () => {
  // A source that pushes a tail AND reports done() SYNCHRONOUSLY, then returns its
  // real unsubscribe. stop() runs with the placeholder unsub before subscribe
  // returns; the feed must reconcile and invoke the real unsub (else a leak).
  await createRoot(async (dispose) => {
    let released = false;
    const src: StreamSource<number> = {
      subscribe(sink, ctl) {
        sink(1);
        ctl.done(); // terminal BEFORE this method returns
        return () => {
          released = true;
        };
      },
    };
    const feed = streamFeed<number>({ source: src });
    assert.deepEqual(feed.items(), [1], "the synchronous tail was folded on done");
    assert.equal(released, true, "the real unsubscribe ran despite the sync terminal");
    dispose();
  });
});

test("owner dispose stops the feed (deterministic teardown)", async () => {
  let m!: ReturnType<typeof manualSource<number>>;
  await createRoot(async (dispose) => {
    m = manualSource<number>();
    streamFeed<number>({ source: m.src });
    dispose();
  });
  assert.equal(m.unsubscribed, true);
});

test("initial seed is visible before any push", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<number>();
    const feed = streamFeed<number>({ source: m.src, initial: [7, 8] });
    assert.deepEqual(feed.items(), [7, 8]);
    dispose();
  });
});

test("fromAsyncIterable drives a feed to completion", async () => {
  async function* gen(): AsyncGenerator<number> {
    yield 1;
    yield 2;
    yield 3;
  }
  await createRoot(async (dispose) => {
    const feed = streamFeed<number>({ source: gen() });
    await tick();
    assert.deepEqual(feed.items(), [1, 2, 3]);
    dispose();
  });
});

test("debounce (number flush mode) coalesces a burst into a trailing run", async () => {
  await createRoot(async (dispose) => {
    const m = manualSource<number>();
    const feed = streamFeed<number>({ source: m.src, flush: 10 });
    m.push(1);
    m.push(2);
    assert.deepEqual(feed.items(), [], "nothing before the debounce elapses");
    await new Promise((r) => setTimeout(r, 25));
    assert.deepEqual(feed.items(), [1, 2]);
    dispose();
  });
});
