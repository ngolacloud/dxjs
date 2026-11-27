# Changelog

All notable changes to dxjs are recorded here. The project follows
[Semantic Versioning](https://semver.org) and the policy in [VERSIONING.md](./VERSIONING.md);
all `@dxjs/*` packages share one version line.

## Unreleased

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
  Disposing a top-level `list()` also removes rows added after mount.

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
