# Changelog

All notable changes to dxjs are recorded here. The project follows
[Semantic Versioning](https://semver.org) and the policy in [VERSIONING.md](./VERSIONING.md);
all `@dxjs/*` packages share one version line.

## 1.3.0 — 2026-11-27

Additive release — one new package and new `@dxjs/dom` exports; every 1.2.0
program keeps compiling and behaving. It also fixes the reactive bindings of
keyed `list()` rows, which went dead after the list first changed.

Distribution is unchanged from 1.2.0: the packages are **not on npm**. Each one
is attached to the GitHub Release as an `npm pack` tarball
(`npm install <tarball-url>`), now including `@dxjs/stream`.

### Streams and async rendering

- **@dxjs/stream** (new) — `streamFeed` consumes a `StreamSource`
  (`fromAsyncIterable`, `fromEventTarget`, `fromWebSocket`, `fromEventSource`, or
  a raw `AsyncIterable`) and exposes a reactive array. A burst of pushes is folded
  in ONE flush per cadence tick (`flush`: `"microtask"` by default, `"raf"`, or a
  trailing debounce in ms — `makeScheduler`), not one update per message.
  Optional `key` coalescing (upsert, last-write-wins) and `order`, a ring buffer
  of the newest `window` items, and `backpressure` on the pending buffer
  (`drop-oldest`, `drop-newest`, `bounded`); every drop and eviction is counted in
  `dropped()`. Also `size()`, `lastBatch()`, `pause()`/`resume()`, `clear()` and
  `stop()`; the source is unsubscribed when the owner is disposed, and a push
  after `stop()` is ignored. `kafkaSource`/`kafkaFeed` take one JSON
  `KafkaRecord` per message from a server-side gateway over SSE or WebSocket
  (browsers do not speak the Kafka protocol), coalesce by record key (or
  `partition:offset`) and keep the array ordered by offset, so records redelivered
  after a reconnect collapse to the latest value.
- **@dxjs/dom** — async control-flow helpers, built on `html` + `list` (no
  `innerHTML`, no `eval`) and accepting a `Resource`, a `Query` or a hand-rolled
  source structurally (`@dxjs/dom` does not depend on those packages):
  - `asyncView` (alias `suspense`) renders the pending / error / empty / data
    states of a source; `keepPrevious` (default `true`) keeps the last data on
    screen during a refetch.
  - `awaitBlock` awaits a promise, or a thunk that re-runs when a signal it reads
    changes; a superseded promise never wins, and teardown invalidates the
    in-flight run.
  - `asyncList` binds the rows of an array source once, by key, so a refetch only
    touches the keys that changed; the pending/error/empty placeholder is a
    separate child.
  - `streamList` binds a `streamFeed` (any `Accessor<T[]>`) by key: only new or
    changed keys call `render()` — no re-render per message.
- **`examples/live-feed`** — a `streamFeed` of Kafka-envelope order events,
  keyed and windowed, rendered with `streamList`, with `size()`/`dropped()`
  counters; its tests drive a deterministic high-cadence source.

### Fixes

- `@dxjs/dom`: in a keyed `list()`, the reactive bindings (text, attributes,
  `.prop`, `?attr`, nested slots) of the rows the list **keeps** no longer go dead
  after the list first changes. Each row was built inside the list's effect, so it
  was owned by it and disposed on every re-run of the list — even when the row
  stayed on screen (event handlers kept working, which hid it). Every row now has
  its own root that lives exactly as long as the row: disposed when its key leaves
  the list, or when the list itself is disposed. Rows are built untracked, so a
  signal read while rendering a row no longer re-runs the whole list. Nested lists
  and lists inside a reactive slot follow the same rule; the non-keyed path (an
  array returned from an accessor) re-renders every row and was not affected, and
  hydration (`@dxjs/server`) already gave each row its own root.
  Disposing a top-level `list()` also removes rows added after mount. A row's
  disposal now also tears down what its template owns (listeners, nested lists),
  so the rows of a nested list die with their outer row. `streamList`,
  `asyncList` and an `awaitBlock` inside a row ride on the same rule.

## 1.2.0 — 2026-11-26

Additive release — new packages, exports and options; every 1.1.0 program keeps
compiling and behaving. It also closes every finding of the 2026-11-25 security
audit.

Distribution: the `@dxjs` scope on npmjs.com belongs to an unrelated account, so
the packages are **not on npm**. Each one is attached to the GitHub Release as an
`npm pack` tarball (`npm install <tarball-url>`). 1.1.0 never reached npm either
(its release job failed before publishing).

### Protocol-neutral transport (ADR 0001)

- **@dxjs/transport** — a `Transport` port (method descriptors + call context)
  with adapters: REST, embedded, **SSE** (reconnect + `Last-Event-ID` resume,
  capped back-off with jitter), **WebSocket** server-streaming (`wsAdapter`,
  auth sent as an authorization frame), `composeTransport`, interceptors, and
  `liveSignal` for streams.
- **@dxjs/edge** — a native-gRPC adapter (`grpcNativeAdapter`).
- New packages over the port: **@dxjs/openapi** (OpenAPI document → runtime
  descriptors + validators), **@dxjs/seiva** (the Seiva profile, structured
  `SeivaError`), **@dxjs/soap** and **@dxjs/proto**.
- The `seiva-console` example runs on the port and shows a structured
  `SeivaError` to the user.

### Security (audit 2026-11-25 — H1–H5, M1–M11, L1–L13)

- XSS/injection: `javascript:`/`data:` URLs sanitised on `href`/`src`/`action`
  (client + SSR); CSV/formula injection neutralised in table export; SSR never
  emits inline `on*` handlers; hydration refuses raw-HTML `.prop`; SOAP tag and
  operation names escaped/validated.
- Resource bounds: bounded regex use (ReDoS); a throwing effect no longer wedges
  the graph; SSE buffer and reconnects bounded; `resource()` retries idempotent;
  `dataTable` search debounced (`debounce`, default 150 ms).
- SSR streaming: `renderToString`/`Chunks`/`Stream` take
  `StreamOptions { timeout, concurrency, signal }`; a Suspense boundary that times
  out, rejects or aborts degrades to its fallback instead of hanging the response.
- Router params decoded safely (a malformed `%`-escape no longer throws), plus the
  rest of the LOW tier.

### Fixes

- `@dxjs/server`: never calls `@event` handlers or refs while rendering;
  `render.ts` compiles under `noUncheckedIndexedAccess`.
- Build: `devtools` compiles after `dom`.

## 1.1.0 — 2026-11-25

Additive release — new exports and options only; every 1.0.0 program keeps
compiling and behaving. The hard invariants (no eval / no inline handlers,
strict-CSP safe, deterministic teardown, escaped data) are unchanged.

### `@dxjs/ui`

- **Component kit v2** — a Tailwind-grade refinement of the design tokens (a
  compact type/space scale, graduated radii/shadows, a full neutral ramp, focus
  rings) plus a **Bootstrap-style size scale** `xs·sm·md·lg·xl·xxl` (≡ `1–6`) on
  the controls.
- **New components**: `button` (variants + sizes + loading), `badge`, `input`,
  `textarea`, `field`, `select`, `switchToggle`, `checkbox`, `radioGroup`,
  `alert`, `modal`, `tooltip`, `skeleton`, `spinner`, `progress`, `meter`,
  `emptyState`, `tabs`, `segmented`, `breadcrumb`, `navPanel`, `avatar`,
  `divider`, `searchableSelect`, `datePicker`, `timer`, `sparkline`, `metric` /
  `metricGrid`, `calendar` (UTC + Intl + holiday engine), `gantt`, `planner`,
  `image`, `video`, `carousel`, `worldMap`, `starRating`, `tableList`,
  `searchFilter` (Odoo-style, Ctrl/⌘+K).
- **Table export** — `toCsv` / `toXls` / `toXlsx` (a real OOXML workbook written
  with a self-contained zip + CRC-32) and an export menu wired into `dataTable`
  and `tableList`.
- **Holiday engine** (`holidays.ts`) — Easter computus + fixed/nth-weekday rules,
  a built-in Angola (`pt-AO`) set, and a pluggable `registerHolidays`.
- **Richer tables** — `dataTable`/`tableList` gain selection, row click, loading
  skeletons, sticky header, column alignment, density and striping.
- **Responsive `appShell`** — a hamburger + slide-in drawer below ~860px.

### Docs

- The documentation site is rebuilt in the delonix style (sticky topbar,
  3-column layout, grouped side nav, right TOC), **bilingual pt-AO / EN** with a
  live language switch, CSP-safe **syntax highlighting**, CDN (esm.sh) vs Node
  (npm install) runnable examples, a **Desktop / Mobile preview** toggle, and a
  page per component (Usage + how to Populate).

## 1.0.0 — 2026-11-24

First stable release. The public API of each package is now under the semver
contract, and the hard invariants hold across every package: **no eval / no inline
handlers**, **strict-CSP safe** (`script-src 'self'; style-src 'self'`),
**deterministic teardown**, and **data escaped** through safe DOM sinks.

### Packages

Core & rendering
- **@dxjs/core** — fine-grained reactivity (signal/computed/effect/batch/untrack/
  createRoot/onCleanup/onError), context DI, and a zero-cost DevTools inspector hook.
- **@dxjs/dom** — the safe reactive renderer (`html`, `list`, JSX bridge, `ref`).
- **@dxjs/jsx** — type-safe automatic JSX runtime over the one renderer.
- **@dxjs/component** — components + lifecycle, and a router with **nested routes,
  shared layouts (`Outlet`) and per-route loaders**.

Platform
- **@dxjs/server** — SSR string + **streaming** rendering (`renderToStream`),
  `suspense()` and `errorBoundary()`, plus fine-grained hydration.
- **@dxjs/transport** — REST, reactive resources, multiplexed SSE (reconnect/
  backoff/resume), and a Connect/gRPC client.
- **@dxjs/edge** — runtime-agnostic Web-fetch handler + native HTTP/2 gRPC.
- **@dxjs/i18n** — reactive locale, message interpolation, Intl formatting;
  **pt-AO / Kwanza (AOA) by default**.

Kit & Cloud Shell
- **@dxjs/ui** — the component kit (appShell, cards, dataTable, virtualList),
  now with an **accessibility pass** (ARIA + keyboard), a **type/spacing token
  scale** and a **light/dark theme** (`createThemeController`).
- **@dxjs/charts** — Chart.js integration (exempt from the size budget).
- **@dxjs/query** / **@dxjs/forms** — React-parity data + forms.
- **@dxjs/canvas** — reactive node-graph for pipelines/architecture diagrams.
- **@dxjs/terminal** — resilient web terminal riding a transport LiveSource.
- **@dxjs/logs** — virtualized multi-source log viewer.
- **@dxjs/k8s** — Kubernetes resource explorer (watch store + resourceVersion cursor).
- **@dxjs/shell** — command palette, idempotent toasts, topology graph.

Tooling
- **@dxjs/dev** — a CSP-safe dev server with HMR that preserves signal state
  across an edit.
- **@dxjs/devtools** — a signals inspector over the core hook.

### Proofs
- `npm run check` — no-eval + jsx-types gates, 201 tests, size budgets — all green.
- `examples/cloud-shell` composes the stack and runs in a real browser under the
  strict CSP with zero violations (`npm run test:shell`).
