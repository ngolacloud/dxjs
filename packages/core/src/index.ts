// @dxjs/core — public surface.
//
// Fine-grained reactivity for dxjs: signals, computeds, effects, batching,
// untracking, and a disposable owner tree. No eval, no globals, deterministic
// teardown. See ../README.md and ../../../DESIGN.md (§4).

export {
  signal,
  computed,
  effect,
  batch,
  untrack,
  onCleanup,
  createRoot,
} from "./graph.ts";

export type { Signal, Accessor, EqualsFn, SignalOptions } from "./graph.ts";
