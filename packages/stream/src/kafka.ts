// @dxjs/stream/kafka — a Kafka-envelope source and a streamFeed preconfigured for
// Kafka records.
//
// GATEWAY CONTRACT: browsers do not speak the Kafka wire protocol. A server-side
// gateway consumes the topic(s) and bridges each record to SSE or WebSocket,
// emitting ONE JSON KafkaRecord per message. The browser then builds the source
// with fromEventSource / fromWebSocket, mapping each frame to a KafkaRecord, e.g.:
//
//   const src = fromEventSource<KafkaRecord<Order>>("/stream/orders");
//   const feed = kafkaFeed({ source: src, window: 500 });
//
// kafkaFeed coalesces by record identity and orders by offset, so a reconnect that
// redelivers records (at-least-once) collapses duplicates to the latest value.

import { streamFeed, type StreamFeed, type StreamFeedOptions, type Backpressure } from "./feed.ts";
import { fromAsyncIterable, type StreamSource } from "./sources.ts";
import type { FlushMode } from "./schedule.ts";

export interface KafkaRecord<V = unknown> {
  topic: string;
  partition: number;
  offset: number;
  key: string | null;
  value: V;
  timestamp?: number;
  headers?: Record<string, string>;
}

/** Wrap an AsyncIterable of KafkaRecords as a StreamSource (e.g. a server-side
 *  consumer feeding an SSR/Node feed). In the browser, prefer fromEventSource /
 *  fromWebSocket over the gateway (see the module header). */
export function kafkaSource<V>(it: AsyncIterable<KafkaRecord<V>>): StreamSource<KafkaRecord<V>> {
  return fromAsyncIterable(it);
}

export interface KafkaFeedOptions<V> {
  source: StreamSource<KafkaRecord<V>> | AsyncIterable<KafkaRecord<V>>;
  window?: number;
  flush?: FlushMode;
  backpressure?: Backpressure;
}

/** A streamFeed tuned for Kafka: records coalesce by identity (the record key, or
 *  `partition:offset` when unkeyed) and the visible array stays ordered by offset
 *  ascending. Partitions reset offsets independently, so a multi-partition feed is
 *  ordered within the gateway's delivery stream, not globally — consume one topic
 *  (or partition) per feed when strict global order matters. */
export function kafkaFeed<V>(o: KafkaFeedOptions<V>): StreamFeed<KafkaRecord<V>> {
  const opts: StreamFeedOptions<KafkaRecord<V>, string> = {
    source: o.source,
    key: (r) => r.key ?? `${r.partition}:${r.offset}`,
    order: (a, b) => a.offset - b.offset,
    window: o.window,
    flush: o.flush,
    backpressure: o.backpressure,
  };
  return streamFeed(opts);
}
