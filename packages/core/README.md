# @dxjs/core

Fine-grained reactivity for [dxjs](../../README.md): **signals**, **computeds**,
**effects**, **batching**, **untracking**, and a disposable **owner tree**.

- **Zero runtime dependencies.**
- **No `eval` / `new Function`** — runs under a strict CSP (no `unsafe-eval`/`unsafe-inline`).
- **Glitch-free:** effects re-run only when a dependency's *value* actually changed.
- **Deterministic teardown:** every effect/computed is owned and disposed; no leaks, no `setTimeout` sequencing.
- **~1.5 KB** gzip (provisional).

```ts
import { signal, computed, effect, batch, untrack, onCleanup, createRoot } from "@dxjs/core";

const count = signal(0);
const double = computed(() => count() * 2);

const dispose = effect(() => {
  console.log("double =", double());
  onCleanup(() => console.log("cleaning up"));
});

count.set(1);               // effect re-runs → "double = 2"
count.update((n) => n + 1); // → "double = 4"
batch(() => { count.set(10); count.set(20); }); // one re-run

dispose(); // tears down the effect and runs its cleanups
```

## API

| Export | Signature | Notes |
|---|---|---|
| `signal<T>(v, opts?)` | `Signal<T>` | `s()` read · `s(v)`/`s.set(v)` write · `s.update(fn)` · `s((p)=>…)` · `s.peek()` untracked |
| `computed<T>(fn, opts?)` | `Accessor<T>` | memoised; recomputes lazily on dependency change |
| `effect(fn)` | `() => void` | runs now and on change; may return a cleanup; returns a disposer |
| `batch(fn)` | `T` | coalesces writes into one flush |
| `untrack(fn)` | `T` | read without subscribing |
| `onCleanup(fn)` | `void` | register teardown for the current owner |
| `createRoot(fn)` | `T` | disposable reactive scope; `fn(dispose)` |

`opts.equals` customises change detection; `equals: false` notifies on every write.

## Guarantees under test

See [`test/signals.test.ts`](test/signals.test.ts): memoisation, unrelated-signal
isolation, dynamic-dependency unsubscribe, glitch-free diamonds, batching,
untracking, cleanup ordering, and full teardown on dispose.

License: MIT OR Apache-2.0.
