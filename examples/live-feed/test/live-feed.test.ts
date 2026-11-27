// examples/live-feed — the e2e "live feed" PROOF (happy-dom, no network).
//
// Proves the whole @dxjs/stream → @dxjs/dom pipeline under a high-cadence stream:
//   (a) 5000 events coalesce into FAR fewer DOM render invocations than 5000
//       (batching + keyed reconciliation — NOT one render per message);
//   (b) with key coalescing, repeated keys collapse (visible rows == distinct keys);
//   (c) a window ring-buffer holds only the newest N; dropped() accounts for the rest;
//   (d) teardown via createRoot stops the feed (no pushes after dispose).
//
// setup.ts installs a happy-dom document on the global BEFORE the renderer runs.
import { body } from "../../../packages/dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { mountLiveFeed, type OrderRecord } from "../src/app.ts";

/** A macrotask boundary. A finite burst generator drains entirely within the
 *  microtask queue (each async-iterator step is a microtask that chains the next),
 *  so by the time a setTimeout(0) callback runs, every push + coalesced flush has
 *  settled. */
const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Build a Kafka-ish record. `key` drives coalescing; `offset` drives order+window. */
function rec(offset: number, key: string | null): OrderRecord {
  return {
    topic: "orders",
    partition: 0,
    offset,
    key,
    value: { id: `o${offset}`, symbol: "AAA", qty: offset % 100, price: offset * 0.5 },
    timestamp: 1_700_000_000_000 + offset,
  };
}

/** A FINITE burst: yield `count` records, mapping offset → key via `keyOf`. Drains
 *  within the microtask queue (no inter-item delay), then completes. */
async function* burst(count: number, keyOf: (offset: number) => string | null): AsyncGenerator<OrderRecord> {
  for (let i = 0; i < count; i++) yield rec(i, keyOf(i));
}

test("(a)+(b) 5000 events coalesce: render count <= window, visible rows == distinct keys", async () => {
  const host = body();
  let renders = 0;
  // 5000 events cycle through only 50 distinct keys → repeated keys collapse.
  const DISTINCT = 50;
  const WINDOW = 200; // larger than DISTINCT so nothing is evicted by the window
  const MESSAGES = 5000;

  const app = mountLiveFeed({
    source: burst(MESSAGES, (i) => `k${i % DISTINCT}`),
    window: WINDOW,
    onRenderRow: () => {
      renders++;
    },
    host,
  });

  await tick();
  await tick(); // belt-and-braces: let any trailing flush settle

  // (b) repeated keys collapsed: exactly DISTINCT rows survive, all distinct keys.
  assert.equal(app.size(), DISTINCT, "visible rows == distinct keys");
  const domRows = host.querySelectorAll("li.rows, ul.rows li");
  assert.equal(domRows.length, DISTINCT, "DOM row count == distinct keys");

  // (a) keyed reconciliation + batching: render fired ONCE per distinct key, so the
  // count is bounded by the window, NOT by the 5000 messages fed.
  assert.ok(
    renders <= WINDOW + 2,
    `render count (${renders}) must be <= window+2 (${WINDOW + 2}), far below ${MESSAGES} messages`,
  );
  assert.equal(renders, DISTINCT, "one render per distinct key (identity reused across updates)");
  assert.equal(app.dropped(), 0, "window not exceeded → nothing dropped");

  // DISPLAY correctness (not just counts): a coalesced key must show its LATEST
  // value, not the first one it was rendered with. k0 is fed offsets 0,50,…,4950;
  // 4950 is its last. A render-count-only proof misses a frozen-first-value bug.
  const latestOffset = MESSAGES - DISTINCT; // 4950: last i with i % DISTINCT === 0
  const k0 = host.querySelector('li[data-key="k0"]');
  assert.ok(k0, "the coalesced k0 row exists");
  assert.equal(k0.querySelector(".off")?.textContent, `#${latestOffset}`, "row shows its LATEST offset, not its first");
  assert.equal(k0.querySelector(".qty")?.textContent, String(latestOffset % 100), "qty reflects the latest record");
  assert.equal(k0.querySelector(".px")?.textContent, (latestOffset * 0.5).toFixed(2), "price reflects the latest record");

  // Expose the numbers for the run log.
  console.log(`[proof a/b] messages=${MESSAGES} distinctKeys=${DISTINCT} renders=${renders} rows=${app.size()}`);

  app.dispose();
});

test("(c) window ring-buffer keeps only the newest N; dropped() accounts for the rest", async () => {
  const host = body();
  let renders = 0;
  const WINDOW = 100;
  const MESSAGES = 5000; // every event has a UNIQUE key → no coalescing, pure windowing

  const app = mountLiveFeed({
    source: burst(MESSAGES, (i) => `u${i}`), // unique keys
    window: WINDOW,
    onRenderRow: () => {
      renders++;
    },
    host,
  });

  await tick();
  await tick();

  assert.equal(app.size(), WINDOW, "ring buffer holds exactly the newest N");
  assert.equal(app.dropped(), MESSAGES - WINDOW, "dropped() == everything evicted past the window");

  // The newest offsets survive: the last row carries the highest offset (ordered asc).
  const rows = host.querySelectorAll("ul.rows li");
  assert.equal(rows.length, WINDOW, "DOM shows exactly N rows");
  const lastOff = rows[rows.length - 1]?.querySelector(".off")?.textContent;
  assert.equal(lastOff, `#${MESSAGES - 1}`, "the newest event is the last visible row");

  console.log(`[proof c] messages=${MESSAGES} window=${WINDOW} rows=${app.size()} dropped=${app.dropped()} renders=${renders}`);

  app.dispose();
});

test("(d) teardown via createRoot stops the feed: no pushes after dispose", async () => {
  const host = body();
  let yields = 0;
  let returned = false;

  // An INFINITE source with a real gap between items, so the event loop can breathe
  // and a mid-stream dispose can interleave. It records how many times it was pulled
  // and whether the iterator was released (return() called on unsubscribe).
  const source: AsyncIterable<OrderRecord> = {
    async *[Symbol.asyncIterator]() {
      try {
        let off = 0;
        while (true) {
          await delay(2);
          yields++;
          yield rec(off++, `k${off % 10}`);
        }
      } finally {
        returned = true;
      }
    },
  };

  const app = mountLiveFeed({ source, window: 50, host });

  // Let a few events flow in.
  await delay(20);
  const sizeBefore = app.size();
  const yieldsBefore = yields;
  assert.ok(sizeBefore > 0, "feed received some events before dispose");

  app.dispose(); // createRoot teardown → feed.stop() + source unsubscribe

  // Give the source ample time to (not) push more.
  await delay(30);

  assert.equal(app.size(), sizeBefore, "no new rows after dispose (feed stopped)");
  assert.ok(returned, "the source iterator was released (return() called on unsubscribe)");
  // At most one more pull may have been in-flight across the await when stop landed;
  // that result is dropped by the post-await `stopped` guard, never pushed.
  assert.ok(yields - yieldsBefore <= 1, "the pump halted — at most one in-flight pull, never pushed");

  console.log(`[proof d] sizeBefore=${sizeBefore} sizeAfter=${app.size()} released=${returned}`);
});
