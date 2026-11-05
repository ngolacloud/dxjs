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
| `@dxjs/component` | function components, `mount`, `onMount` | **F1 — done & green** (router next) |
| `@dxjs/transport` | REST + Connect/gRPC + multiplexed SSE | planned (F3) |
| `@dxjs/server` | SSR streaming + hydration + edge adapters | planned (F2/F4) |

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
