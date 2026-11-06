# dxjs

A lean, secure, **fine-grained reactive** UI engine for the NgolaCloud console —
born from the StillJS audit (`../seiva/audit/`) as a clean-room design that keeps
the good ideas and discards the `eval`-based rendering.

> **Not** a React clone. dxjs uses signals (no Virtual DOM) for small bundles and
> surgical DOM updates, and is built to run under the strict, hash-pinned CSP of
> the Seiva Console Admin — **no `eval`, no inline handlers, escape by default**.

See **[`DESIGN.md`](DESIGN.md)** for the full technical design (reactivity model,
rendering, component model, transport REST/gRPC/SSE, SSR/edge, security, build).

## Status

| Package | What | State |
|---|---|---|
| `@dxjs/core` | signals / computed / effect / batch / owner tree | **F0 — done & green** |
| `@dxjs/dom` | `html` + reactive bindings (escaped sinks) + teardown | **F1 — done & green** |
| `@dxjs/component` | function components, `mount`, `onMount`, `createRouter` | **F1 — done & green** |
| `@dxjs/server` | `renderToString` (DOM-free SSR) + fine-grained `hydrate` | **F2 — done & green** |
| `@dxjs/transport` | REST (`createClient`), `resource`, multiplexed SSE (`createLiveSource`), Connect (gRPC) | **F3 — done & green** |
| `@dxjs/canvas` | reactive node-graph: model + geometry + Canvas-2D renderer + drag/connect/pan/zoom (data pipelines, architecture diagrams) | **F5 — done & green** |

**Real bundle sizes** (esbuild min+gzip): core 1.0 KB · dom 1.2 KB · component 1.1 KB · server 0.7 KB. A full reactive app (core+dom+component) is **~2.8 KB gzip** — vs ~45 KB for React+ReactDOM.

**Proven under a strict CSP in a real browser** (`e2e/csp`): the demo renders and reacts under `default-src 'none'; script-src 'self'` — **no `unsafe-eval`, no `unsafe-inline`** — with zero CSP violations and injected data escaped (no XSS). This is the premise the StillJS audit said `eval`-based engines cannot meet.

```ts
import { signal } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { component, mount } from "@dxjs/component";

const Counter = component(() => {
  const n = signal(0);
  return html`<button @click=${() => n.update((x) => x + 1)}>n = ${() => n()}</button>`;
});
mount(Counter, document.querySelector("#app"), {}); // reactive, CSP-safe, no eval
```

## Develop

Requires Node ≥ 22 (dxjs runs TypeScript via native type-stripping — no build to test).

```sh
npm test            # node --test over native .ts
npm run gate:no-eval # CSP-safety gate (no eval/inline/innerHTML)
npm run gate:size    # bundle size budget
npm run check        # all gates
```

## Quality gates

- **no-eval gate** — fails the build on `eval(`, `new Function`, inline `on*=`, `document.write`, `.innerHTML =`.
- **tests** — `node:test`, native TS, 15 reactivity tests (glitch-free, diamond, batch, teardown…).
- **size budget** — `@dxjs/core` ≤ 2 KB gzip.

License: **MIT OR Apache-2.0**.
