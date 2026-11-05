// @dxjs/core — fine-grained reactive graph.
//
// A push-pull reactive system (signals + computeds + effects) in the style of
// Solid/"reactively": signal writes PUSH invalidation (mark observers), values
// are PULLed lazily and validated through a CHECK/DIRTY colouring so effects
// re-run only when a dependency's VALUE actually changed (glitch-free).
//
// Hard rules (carried from the StillJS audit): no eval / new Function anywhere,
// no globals leaked onto `window`, deterministic teardown (every effect/computed
// is owned and disposed), no setTimeout-based sequencing.

export type Accessor<T> = () => T;

/** A writable reactive value. Call with no args to read; see methods to write. */
export interface Signal<T> {
  (): T;
  /** Set a literal value, or pass a function to derive from the previous value. */
  (next: T | ((prev: T) => T)): T;
  /** Set a literal value (never treated as an updater). */
  set(next: T): T;
  /** Derive the next value from the previous one. */
  update(fn: (prev: T) => T): T;
  /** Read without creating a dependency. */
  peek(): T;
}

export type EqualsFn<T> = (a: T, b: T) => boolean;
export interface SignalOptions<T> {
  /** Custom equality; `false` disables memoisation (every write notifies). */
  equals?: EqualsFn<T> | false;
}

const CLEAN = 0;
const CHECK = 1;
const DIRTY = 2;
type State = typeof CLEAN | typeof CHECK | typeof DIRTY;

interface Scope {
  owned: Node[] | null;
  cleanups: Array<() => void> | null;
}

interface Node extends Scope {
  value: unknown;
  fn: (() => unknown) | null; // null => plain signal (never recomputes)
  state: State;
  sources: Set<Node> | null; // dependencies (computations only)
  observers: Set<Node> | null; // dependents
  equals: EqualsFn<unknown>;
  effect: boolean;
  init: boolean; // a computed has produced at least one value
  disposed: boolean;
  queued: boolean;
}

// --- reactive context (module-scoped; never on window) --------------------
let Listener: Node | null = null; // the computation currently tracking reads
let CurrentScope: Scope | null = null; // the owner for new computations / cleanups
let batchDepth = 0;
const queue: Node[] = [];
let flushing = false;

const identityFalse = (): boolean => false;

function makeNode<T>(
  value: T | undefined,
  fn: (() => unknown) | null,
  effect: boolean,
  options?: SignalOptions<T>,
): Node {
  const equals =
    options && options.equals === false
      ? identityFalse
      : (options && options.equals) || (Object.is as EqualsFn<unknown>);
  return {
    value,
    fn,
    state: CLEAN,
    sources: null,
    observers: null,
    equals: equals as EqualsFn<unknown>,
    effect,
    init: false,
    disposed: false,
    queued: false,
    owned: null,
    cleanups: null,
  };
}

function own(node: Node): void {
  if (CurrentScope) (CurrentScope.owned ||= []).push(node);
}

// --- reads / writes -------------------------------------------------------
function readNode(node: Node): unknown {
  if (node.fn && !node.effect) updateIfNecessary(node); // refresh a computed
  if (Listener) {
    (Listener.sources ||= new Set()).add(node);
    (node.observers ||= new Set()).add(Listener);
  }
  return node.value;
}

function writeNode(node: Node, next: unknown): unknown {
  if (node.equals(node.value, next)) return node.value;
  node.value = next;
  if (node.observers) for (const o of node.observers) markStale(o, DIRTY);
  if (!batchDepth) flush();
  return node.value;
}

// --- invalidation (push) --------------------------------------------------
function markStale(node: Node, state: State): void {
  if (node.state < state) {
    const wasClean = node.state === CLEAN;
    node.state = state;
    if (wasClean) {
      if (node.effect) enqueue(node);
      else if (node.observers) for (const o of node.observers) markStale(o, CHECK);
    }
  }
}

function enqueue(node: Node): void {
  if (!node.queued) {
    node.queued = true;
    queue.push(node);
  }
}

// --- validation / recompute (pull) ---------------------------------------
function updateIfNecessary(node: Node): void {
  if (node.state === CLEAN) return;
  if (node.state === CHECK && node.sources) {
    for (const s of node.sources) {
      if (s.fn && !s.effect) updateIfNecessary(s);
      if (node.state === DIRTY) break; // a source's recompute marked us dirty
    }
  }
  if (node.state === DIRTY) update(node);
  node.state = CLEAN;
}

function update(node: Node): void {
  cleanupNode(node, false); // run cleanups + unlink old sources (keep the node)
  const prevListener = Listener;
  const prevScope = CurrentScope;
  Listener = node;
  CurrentScope = node;
  let result: unknown;
  try {
    result = node.fn!();
  } finally {
    Listener = prevListener;
    CurrentScope = prevScope;
  }
  if (node.effect) {
    // An effect may return a cleanup function (run before the next pass/dispose).
    if (typeof result === "function") (node.cleanups ||= []).push(result as () => void);
  } else if (!node.init || !node.equals(node.value, result)) {
    node.value = result;
    node.init = true;
    // The value changed: escalate observers straight to DIRTY (they are already
    // CHECK from the push phase, so no re-propagation/scheduling is needed here).
    if (node.observers) for (const o of node.observers) if (o.state < DIRTY) o.state = DIRTY;
  }
}

// --- teardown -------------------------------------------------------------
function cleanupNode(node: Node, dispose: boolean): void {
  if (node.owned) {
    for (const child of node.owned) disposeNode(child);
    node.owned = null;
  }
  if (node.cleanups) {
    for (const fn of node.cleanups) fn();
    node.cleanups = null;
  }
  if (node.sources) {
    for (const s of node.sources) s.observers && s.observers.delete(node);
    node.sources = null;
  }
  if (dispose) {
    node.disposed = true;
    if (node.observers) {
      for (const o of node.observers) o.sources && o.sources.delete(node);
      node.observers = null;
    }
  }
}

function disposeNode(node: Node): void {
  if (!node.disposed) cleanupNode(node, true);
}

// --- scheduler ------------------------------------------------------------
const LOOP_LIMIT = 1_000_000;
function flush(): void {
  if (flushing || batchDepth) return;
  flushing = true;
  try {
    let i = 0;
    for (; i < queue.length; i++) {
      if (i > LOOP_LIMIT) throw new Error("dxjs: potential infinite update loop");
      const node = queue[i];
      node.queued = false;
      if (!node.disposed) updateIfNecessary(node);
    }
  } finally {
    queue.length = 0;
    flushing = false;
  }
}

// --- public API -----------------------------------------------------------
/** Create a writable reactive value. */
export function signal<T>(value: T, options?: SignalOptions<T>): Signal<T> {
  const node = makeNode(value, null, false, options);
  const s = ((...args: [] | [T | ((prev: T) => T)]): T => {
    if (args.length === 0) return readNode(node) as T;
    const a = args[0];
    const next = typeof a === "function" ? (a as (p: T) => T)(node.value as T) : a;
    return writeNode(node, next) as T;
  }) as Signal<T>;
  s.set = (next: T): T => writeNode(node, next) as T;
  s.update = (fn: (prev: T) => T): T => writeNode(node, fn(node.value as T)) as T;
  s.peek = (): T => node.value as T;
  return s;
}

/** Create a memoised derived value; recomputes only when a dependency changes. */
export function computed<T>(fn: () => T, options?: SignalOptions<T>): Accessor<T> {
  const node = makeNode<T>(undefined, fn as () => unknown, false, options);
  node.state = DIRTY;
  own(node);
  return (): T => readNode(node) as T;
}

/**
 * Run a side effect now and again whenever a tracked dependency's value
 * changes. Returns a disposer. The effect may return a cleanup function.
 */
export function effect(fn: () => void | (() => void)): () => void {
  const node = makeNode(undefined, fn as () => unknown, true);
  node.state = DIRTY;
  own(node);
  if (batchDepth) enqueue(node);
  else updateIfNecessary(node); // run synchronously to collect deps
  return (): void => disposeNode(node);
}

/** Batch multiple writes into a single effect flush. */
export function batch<T>(fn: () => T): T {
  if (batchDepth) return fn();
  batchDepth++;
  try {
    return fn();
  } finally {
    batchDepth--;
    flush();
  }
}

/** Read reactive values inside `fn` without subscribing to them. */
export function untrack<T>(fn: () => T): T {
  const prev = Listener;
  Listener = null;
  try {
    return fn();
  } finally {
    Listener = prev;
  }
}

/** Register a cleanup for the current owner (effect, computed, or root). */
export function onCleanup(fn: () => void): void {
  if (CurrentScope) (CurrentScope.cleanups ||= []).push(fn);
}

/**
 * Create a disposable reactive scope. `fn` receives a `dispose` that tears down
 * every effect/computed/cleanup created within — deterministic teardown.
 */
export function createRoot<T>(fn: (dispose: () => void) => T): T {
  const scope = makeNode(undefined, null, false);
  const prevListener = Listener;
  const prevScope = CurrentScope;
  Listener = null;
  CurrentScope = scope;
  try {
    return fn(() => disposeNode(scope));
  } finally {
    Listener = prevListener;
    CurrentScope = prevScope;
  }
}
