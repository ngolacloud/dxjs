// @dxjs/stream — reactive ingestion of mass-data streams/queues for dxjs.
//
// A single API — `streamFeed` — consumes a StreamSource (SSE, WebSocket, any
// AsyncIterable, or a Kafka-envelope bridge) and exposes a reactive array the UI
// binds to. Rapid pushes are coalesced into batched flushes (one signal update per
// cadence tick, not per message), optionally keyed (upsert / last-write-wins),
// windowed to the newest N (ring buffer), and bounded by a backpressure policy.
// Built on @dxjs/core signals: no eval, no globals on window, deterministic
// teardown (the feed stops and the source unsubscribes on owner dispose).

// Scheduler — batching cadence (microtask / raf / debounce ms).
export { makeScheduler } from "./schedule.ts";
export type { FlushMode, Scheduler } from "./schedule.ts";

// Sources — adapters bridging push/pull producers into a StreamSource.
export { fromAsyncIterable, fromEventTarget, fromWebSocket, fromEventSource } from "./sources.ts";
export type { StreamSource, StreamController, WsSourceOptions, SseSourceOptions } from "./sources.ts";

// Feed — the reactive buffer (batching, coalescing, windowing, backpressure).
export { streamFeed } from "./feed.ts";
export type { Backpressure, StreamFeedOptions, StreamFeed } from "./feed.ts";

// Kafka — envelope type + preconfigured source/feed over the gateway contract.
export { kafkaSource, kafkaFeed } from "./kafka.ts";
export type { KafkaRecord, KafkaFeedOptions } from "./kafka.ts";
