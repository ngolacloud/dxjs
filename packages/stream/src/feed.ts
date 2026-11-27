// @dxjs/stream/feed — the reactive buffer at the heart of the package.
//
// A streamFeed consumes a StreamSource and exposes a reactive array the UI binds
// to. Incoming items land in a PENDING buffer (bounded by a backpressure policy);
// a scheduler coalesces a burst into ONE flush per cadence tick. On flush the
// pending batch is folded into the visible array — appended (unkeyed) or upserted
// last-write-wins (keyed), optionally kept sorted by `order` and trimmed to a ring
// buffer of the newest `window`. Every flush writes a NEW array reference so signal
// equality notifies, and ALL state writes happen inside ONE untrack+batch so a
// burst never produces a half-applied intermediate state or spurious dependencies.
//
// Owner-tied: it subscribes on creation and stops on owner dispose; a late push
// after stop() is a no-op (the "no write after teardown" discipline, as in
// @dxjs/transport).

import { signal, batch, untrack, onCleanup, type Accessor } from "@dxjs/core";
import { fromAsyncIterable, type StreamSource, type StreamController } from "./sources.ts";
import { makeScheduler, type FlushMode } from "./schedule.ts";

export type Backpressure = { max: number; policy: "drop-oldest" | "drop-newest" | "bounded" };

export interface StreamFeedOptions<T, K = unknown> {
  /** A StreamSource, or a raw AsyncIterable (wrapped via fromAsyncIterable). */
  source: StreamSource<T> | AsyncIterable<T>;
  /** Key extractor — enables coalescing (upsert / last-write-wins by K). */
  key?: (item: T) => K;
  /** Keyed-mode ordering (e.g. by offset); default = insertion order. */
  order?: (a: T, b: T) => number;
  /** Ring buffer: keep only the newest N (by resulting order); evictions count as dropped. */
  window?: number;
  /** Batching cadence; default "microtask". */
  flush?: FlushMode;
  /** Cap on the PENDING (pre-flush) buffer. */
  backpressure?: Backpressure;
  initial?: T[];
  /** Start paused: collect under backpressure, do not reflect into items() until resume. */
  paused?: boolean;
}

export interface StreamFeed<T> extends Accessor<T[]> {
  items: Accessor<T[]>;
  size: Accessor<number>;
  /** The items folded in the most recent flush (for toasts / notifications). */
  lastBatch: Accessor<T[]>;
  /** Total items dropped by backpressure OR window eviction. */
  dropped: Accessor<number>;
  paused: Accessor<boolean>;
  pause(): void;
  resume(): void;
  clear(): void;
  stop(): void;
}

/** Narrow the source union: a StreamSource has a `subscribe` method. */
function isStreamSource<T>(s: StreamSource<T> | AsyncIterable<T>): s is StreamSource<T> {
  return typeof (s as StreamSource<T>).subscribe === "function";
}

/** Create a reactive mass-data feed. See the module header for the full semantics. */
export function streamFeed<T, K = unknown>(o: StreamFeedOptions<T, K>): StreamFeed<T> {
  const items = signal<T[]>(o.initial ? o.initial.slice() : []);
  const lastBatch = signal<T[]>([]);
  const dropped = signal(0);
  const paused = signal(o.paused ?? false);

  const key = o.key;
  const order = o.order;
  const windowSize = o.window;
  const bp = o.backpressure;

  let pending: T[] = [];
  let stopped = false;

  // Fold the pending batch into the current visible array, returning a NEW array.
  const fold = (current: T[], incoming: T[]): T[] => {
    if (!key) return current.concat(incoming); // unkeyed: append in arrival order
    // Keyed upsert: copy, then apply each incoming by key. Processing the batch in
    // arrival order means many pushes to one key collapse to the latest value.
    const next = current.slice();
    const indexByKey = new Map<K, number>();
    let i = 0;
    for (const el of current) {
      indexByKey.set(key(el), i);
      i++;
    }
    for (const item of incoming) {
      const k = key(item);
      const at = indexByKey.get(k);
      if (at !== undefined) {
        next[at] = item; // last-write-wins
      } else {
        indexByKey.set(k, next.length);
        next.push(item);
      }
    }
    // Array.prototype.sort is stable (V8), so equal-ranked items keep insertion order.
    if (order) next.sort(order);
    return next;
  };

  const flush = (): void => {
    if (stopped || paused.peek() || pending.length === 0) return;
    const incoming = pending;
    pending = [];
    untrack(() =>
      batch(() => {
        const next = fold(items.peek(), incoming);
        // Ring buffer: drop from the front (oldest by resulting order) until it fits.
        if (windowSize !== undefined && next.length > windowSize) {
          const evicted = next.length - windowSize;
          next.splice(0, evicted);
          dropped.set(dropped.peek() + evicted);
        }
        items.set(next); // always a fresh reference -> notifies
        lastBatch.set(incoming); // exactly what was folded this flush
      }),
    );
  };

  const scheduler = makeScheduler(o.flush ?? "microtask", flush);

  // Backpressure guards the PENDING buffer BEFORE a flush. Every drop counts.
  const push = (item: T): void => {
    if (stopped) return;
    if (bp && pending.length >= bp.max) {
      if (bp.policy === "drop-newest") {
        dropped.set(dropped.peek() + 1); // reject the incoming item
        return;
      }
      // drop-oldest / bounded (== keep newest max): evict from the front to make room.
      const overflow = pending.length - bp.max + 1;
      pending.splice(0, overflow);
      dropped.set(dropped.peek() + overflow);
    }
    pending.push(item);
    scheduler.request();
  };

  const pause = (): void => {
    paused.set(true);
  };
  const resume = (): void => {
    paused.set(false);
    flush(); // reflect whatever accumulated while paused, then resume normal cadence
  };
  const clear = (): void => {
    pending = [];
    untrack(() => items.set([])); // empties items + pending; does NOT reset dropped
  };
  const stop = (): void => {
    if (stopped) return; // idempotent
    stopped = true;
    scheduler.cancel();
    unsub();
  };

  // A failed/exhausted source: fold whatever arrived, then release. The feed has no
  // error surface by contract — a dead source simply terminates ingestion.
  const ctl: StreamController = {
    error(): void {
      flush();
      stop();
    },
    done(): void {
      flush();
      stop();
    },
  };

  // Declared before subscribe so a source that emits synchronously (and may call
  // stop() via ctl) never hits a temporal-dead-zone on `unsub`.
  let unsub: () => void = () => {};
  const source = isStreamSource(o.source) ? o.source : fromAsyncIterable(o.source);
  // Subscribe on creation; tear down on owner dispose (deterministic teardown).
  unsub = source.subscribe(push, ctl);
  // A source may terminate synchronously INSIDE subscribe (ctl.done/error before it
  // returns): stop() then ran against the placeholder unsub, orphaning the real one
  // just assigned above. Reconcile — release it now; otherwise bind teardown to the
  // owner. (stop() is idempotent, so binding it when already stopped is harmless.)
  if (stopped) unsub();
  else onCleanup(stop);

  const feed = (() => items()) as StreamFeed<T>;
  feed.items = () => items();
  feed.size = () => items().length;
  feed.lastBatch = () => lastBatch();
  feed.dropped = () => dropped();
  feed.paused = () => paused();
  feed.pause = pause;
  feed.resume = resume;
  feed.clear = clear;
  feed.stop = stop;
  return feed;
}
