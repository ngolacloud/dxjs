# @dxjs/stream

Reactive ingestion of mass-data streams/queues for dxjs.

One API — `streamFeed` — consumes a `StreamSource` (SSE, WebSocket, any
`AsyncIterable`, or a Kafka-envelope bridge) and exposes a reactive array the UI
binds to. Rapid pushes are **batched** into one signal update per flush tick (not
per message), optionally **coalesced by key** (upsert / last-write-wins),
**windowed** to the last N (ring buffer), and bounded by a **backpressure** policy
(`drop-oldest` / `drop-newest` / `bounded`).

Built on `@dxjs/core` signals: no `eval`, no globals on `window`, deterministic
teardown (the subscription is aborted on owner dispose).

See `src/` for the full surface. Bind the feed to the DOM with
`@dxjs/dom`'s `streamList` / `asyncList` for keyed, re-render-minimal rendering.
