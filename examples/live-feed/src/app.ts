// examples/live-feed — a "live feed" proof wiring @dxjs/stream to @dxjs/dom.
//
// A streamFeed ingests a high-cadence stream of Kafka-envelope events (an
// INJECTABLE AsyncIterable — in production this is fromEventSource / fromWebSocket
// over the gateway; in tests it is a deterministic burst/infinite generator).
// Rapid pushes coalesce into ONE flush per cadence tick; the visible array is
// keyed (upsert / last-write-wins) and windowed to the newest N (ring buffer).
// @dxjs/dom streamList binds the array by key, so only NEW keys call render() and
// touch the DOM — never one render per message. size()/dropped() counters are
// plain reactive text children. No network, no eval, no globals: happy-dom-safe.

import { html, render, streamList, type TemplateResult } from "@dxjs/dom";
import { streamFeed, type KafkaRecord, type StreamFeed, type Backpressure } from "@dxjs/stream";
import type { FlushMode } from "@dxjs/stream";
import { batch, createRoot, onCleanup, signal, untrack, type Accessor, type Signal } from "@dxjs/core";

/** The business payload carried in each Kafka record's value. */
export interface OrderEvent {
  id: string;
  symbol: string;
  qty: number;
  price: number;
}

export type OrderRecord = KafkaRecord<OrderEvent>;

export interface LiveFeedOptions {
  /** The event stream. Any AsyncIterable of Kafka records — injected for tests. */
  source: AsyncIterable<OrderRecord>;
  /** Ring buffer: keep only the newest N rows. */
  window: number;
  /** Batching cadence. Default "microtask". */
  flush?: FlushMode;
  /** Pre-flush buffer cap (backpressure); omit for an unbounded pending buffer. */
  backpressure?: Backpressure;
  /** Where to mount the view. */
  host: Element;
  /**
   * Called ONCE per row keyed-render — the probe the proof counts to show that
   * 5000 messages do NOT cause 5000 renders (keyed reconciliation + batching).
   */
  onRenderRow?: (rec: OrderRecord) => void;
}

export interface LiveFeedApp {
  feed: StreamFeed<OrderRecord>;
  /** Visible row count (== feed.size()). */
  size: Accessor<number>;
  /** Items dropped by window eviction (+ backpressure, if any). */
  dropped: Accessor<number>;
  /** Tear down the view AND stop the feed + unsubscribe the source. */
  dispose: () => void;
}

/** A stable per-key row: the keyed `list` renders it ONCE, so the row binds to the
 *  live `cell` signal — last-write-wins updates reach the DOM without a re-render. */
interface Cell {
  readonly key: string;
  readonly cell: Signal<OrderRecord>;
}

/**
 * Render one row. The keyed reconciler calls this exactly once per key (the
 * `onRenderRow` probe fires here, once), so EVERY value interpolation must be a
 * reactive getter reading `c.cell()`: when a later record upserts this key the feed
 * sets the cell and the bound text updates in place — a non-reactive snapshot would
 * freeze the row on its first value (that was the bug).
 */
function row(c: Cell, onRenderRow?: (r: OrderRecord) => void): TemplateResult {
  onRenderRow?.(c.cell.peek());
  const v = (): OrderRecord["value"] => c.cell().value;
  // All interpolations go through @dxjs/dom's escaped text sinks (CSP-safe).
  return html`<li data-key=${c.key}>
    <span class="sym">${() => v().symbol}</span>
    <span class="qty">${() => String(v().qty)}</span>
    <span class="px">${() => v().price.toFixed(2)}</span>
    <span class="off">#${() => String(c.cell().offset)}</span>
  </li>`;
}

/**
 * Wire the feed + view and mount into `host`, all under ONE createRoot so a single
 * `dispose()` tears down the view AND stops the feed + unsubscribes the source
 * (deterministic, owner-tied teardown). The feed is created INSIDE the root so its
 * onCleanup(stop) binds to this scope regardless of the caller's reactive context.
 */
export function mountLiveFeed(o: LiveFeedOptions): LiveFeedApp {
  return createRoot((dispose) => {
    const feed = streamFeed<OrderRecord, string>({
      source: o.source,
      // Coalesce by record key (last-write-wins): repeated keys collapse to one row.
      key: (r) => r.key ?? `${r.partition}:${r.offset}`,
      // Keep the visible list ordered by offset ascending (gateway delivery order).
      order: (a, b) => a.offset - b.offset,
      window: o.window,
      flush: o.flush ?? "microtask",
      ...(o.backpressure ? { backpressure: o.backpressure } : {}),
    });

    const keyOf = (r: OrderRecord): string => r.key ?? `${r.partition}:${r.offset}`;

    // Per-key reactive cells. The feed delivers a fresh coalesced array per flush;
    // we project it to STABLE Cell holders (one per key, identity reused) and keep
    // each key's signal pointed at its latest record. streamList/`list` then renders
    // a key once and the row binds to its cell — updates reflect without re-render.
    const cells = new Map<string, Cell>();
    const rows = (): Cell[] => {
      const arr = feed.items(); // the tracked dependency: re-projects on each flush
      // Cell writes must not become dependencies of the list effect (untrack); the
      // whole projection settles as ONE propagation (batch) so a coalesced flush
      // never yields a half-updated frame.
      return untrack(() =>
        batch(() => {
          const live = new Set<string>();
          const out: Cell[] = [];
          for (const r of arr) {
            const k = keyOf(r);
            live.add(k);
            let c = cells.get(k);
            if (!c) {
              c = { key: k, cell: signal(r) };
              cells.set(k, c);
            } else if (c.cell.peek() !== r) {
              c.cell.set(r); // last-write-wins → bound row text updates in place
            }
            out.push(c);
          }
          for (const k of cells.keys()) if (!live.has(k)) cells.delete(k); // evicted key
          return out;
        }),
      );
    };

    // streamList binds the array ONCE and diffs by key: only new keys render.
    const view = html`
      <section class="live-feed">
        <header>
          <span class="count">rows: ${() => String(feed.size())}</span>
          <span class="dropped">dropped: ${() => String(feed.dropped())}</span>
        </header>
        <ul class="rows">
          ${streamList(rows, {
            key: (c: Cell) => c.key,
            render: (c: Cell) => row(c, o.onRenderRow),
            empty: () => html`<li class="empty">waiting for events…</li>`,
          })}
        </ul>
      </section>
    `;

    // render() opens its OWN (detached) root; tie its disposer to this scope so a
    // single dispose() cascades to the view as well as to the feed.
    onCleanup(render(view, o.host));

    return {
      feed,
      size: feed.size,
      dropped: feed.dropped,
      dispose, // tears down this root: view detaches, feed stops, source unsubscribes
    };
  });
}
