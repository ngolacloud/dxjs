# Changelog

All notable changes to dxjs are recorded here. The project follows
[Semantic Versioning](https://semver.org) and the policy in [VERSIONING.md](./VERSIONING.md);
all `@dxjs/*` packages share one version line.

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
