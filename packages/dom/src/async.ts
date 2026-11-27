// @dxjs/dom/async — async-native control-flow helpers.
//
// suspense/asyncView, awaitBlock, asyncList, streamList render the
// pending/error/empty/data states of a Resource/Query/streamFeed as reactive
// TemplateResults. Everything is built on `html` + `list` (CSP-safe sinks, no
// innerHTML/eval) and on @dxjs/core reactivity, so updates are surgical and torn
// down by the owning scope. We accept the transport/query/stream shapes
// STRUCTURALLY — @dxjs/dom must not depend on those packages (dep cycle).

import { signal, effect, untrack, onCleanup, type Accessor } from "@dxjs/core";
import { html, list, type TemplateResult } from "./dom.ts";

/** The normalized async shape every helper renders over. */
export interface AsyncSource<T> {
  data: () => T | undefined;
  error: () => unknown;
  /** True only while loading the FIRST value (no data yet). */
  pending: () => boolean;
}

/** Either a ready {@link AsyncSource} or a transport/query-style callable accessor. */
export type AsyncInput<T> =
  | AsyncSource<T>
  | (Accessor<T | undefined> & {
      error: Accessor<unknown>;
      loading?: Accessor<boolean>;
      isLoading?: Accessor<boolean>;
    });

/**
 * Normalize any accepted input to an {@link AsyncSource}. Feature-detected, not
 * instanceof-ed, so a Resource, a Query and a hand-rolled source all work:
 *   - a `.pending` function → already an AsyncSource; wrap its members verbatim.
 *   - otherwise the input IS the data accessor (callable); `error` is required and
 *     "pending" is derived from `.loading ?? .isLoading`, gated on `data()===undefined`
 *     so it means "still loading the first value" — a refetch over existing data is
 *     NOT pending (that is what keepPrevious hangs on).
 */
export function toAsyncSource<T>(input: AsyncInput<T>): AsyncSource<T> {
  const probe = input as {
    data?: () => T | undefined;
    error: () => unknown;
    pending?: () => boolean;
  };
  if (typeof probe.pending === "function" && typeof probe.data === "function") {
    const dat = probe.data;
    const err = probe.error;
    const pend = probe.pending;
    return { data: () => dat(), error: () => err(), pending: () => pend() };
  }
  // Callable-accessor form (Resource/Query): the value is the function itself.
  const call = input as Accessor<T | undefined> & {
    error: () => unknown;
    loading?: () => boolean;
    isLoading?: () => boolean;
  };
  const loadingFn =
    typeof call.loading === "function"
      ? call.loading
      : typeof call.isLoading === "function"
        ? call.isLoading
        : undefined;
  const data = (): T | undefined => call();
  const error = (): unknown => call.error();
  const pending = (): boolean => (loadingFn ? loadingFn() : false) && data() === undefined;
  return { data, error, pending };
}

type View = TemplateResult | string;

/** Minimal fallback when no `error` branch is supplied — never throw on a missing branch. */
function defaultError(e: unknown): string {
  return "Error: " + (e instanceof Error ? e.message : String(e));
}

function isEmptyValue(v: unknown): boolean {
  return v == null || (Array.isArray(v) && v.length === 0);
}

export interface AsyncViewOptions<T> {
  then: (value: T) => View;
  /** Shown while loading with no data yet (or during any refetch when keepPrevious is false). */
  pending?: () => View;
  error?: (e: unknown) => View;
  /** Shown when the resolved value is null/undefined/[]. */
  empty?: () => View;
  /** Keep showing the last data during a refetch instead of flipping to `pending`. Default true. */
  keepPrevious?: boolean;
}

/**
 * Render the four states of an async source behind ONE reactive child. The child
 * reads error()/pending()/data() so it re-picks the branch whenever the source
 * signals change. Missing optional branches fall back to "" — never a throw.
 */
export function asyncView<T>(input: AsyncInput<T>, o: AsyncViewOptions<T>): TemplateResult {
  const src = toAsyncSource(input);
  const keepPrev = o.keepPrevious ?? true;
  const pick = (): View => {
    const e = src.error();
    if (e !== undefined) return o.error ? o.error(e) : defaultError(e);
    const p = src.pending();
    const d = src.data();
    // Still loading the first value, or refetching while keepPrevious is off.
    if (p && (d === undefined || !keepPrev)) return o.pending ? o.pending() : "";
    if (isEmptyValue(d)) return o.empty ? o.empty() : "";
    return o.then(d as T);
  };
  return html`${() => pick()}`;
}

/** Alias: suspense reads as the React-ish name, asyncView as the dxjs one. */
export const suspense = asyncView;

export interface AwaitOptions<T> extends AsyncViewOptions<T> {}

/**
 * Await a promise (or a thunk) and render it through {@link asyncView}. A tiny
 * local resource (data/error/loading signals + a generation counter) backs it. A
 * THUNK is run inside an effect, so it re-fetches when a signal it reads changes;
 * each run bumps the generation and a stale/superseded promise can never win
 * (exact idiom from transport/resource.ts). Teardown invalidates the in-flight run.
 */
export function awaitBlock<T>(promise: Promise<T> | (() => Promise<T>), o: AwaitOptions<T>): TemplateResult {
  const data = signal<T | undefined>(undefined);
  const error = signal<unknown>(undefined);
  const loading = signal(true);
  const isThunk = typeof promise === "function";
  let gen = 0;

  const run = (): void => {
    const my = ++gen;
    // Writes are untracked so this run does not depend on its own state signals.
    untrack(() => {
      loading.set(true);
      error.set(undefined);
    });
    // The thunk is invoked HERE (tracked, inside the effect below) so reactive
    // reads inside it become dependencies and re-trigger `run`.
    const p = isThunk ? (promise as () => Promise<T>)() : (promise as Promise<T>);
    p.then(
      (v) => {
        if (my !== gen) return; // superseded or torn down → discard
        untrack(() => {
          data.set(v);
          loading.set(false);
        });
      },
      (e) => {
        if (my !== gen) return;
        untrack(() => {
          error.set(e);
          loading.set(false);
        });
      },
    );
  };

  if (isThunk) effect(() => run());
  else run();
  onCleanup(() => {
    gen++; // invalidate any in-flight result
  });

  const src: AsyncSource<T> = {
    data: () => data(),
    error: () => error(),
    pending: () => loading() && data() === undefined,
  };
  return asyncView(src, o);
}

export interface AsyncListOptions<T> {
  key: (item: T, i: number) => string | number;
  render: (item: T) => TemplateResult;
  pending?: () => View;
  empty?: () => View;
  error?: (e: unknown) => View;
}

/**
 * Array-specialised {@link asyncView}. The rows are bound ONCE via `list` reading
 * data() reactively, so a refetch reconciles by key (only changed keys touch the
 * DOM — the whole list is NOT rebuilt). A sibling reactive child carries the
 * pending/error/empty placeholder and collapses to "" once rows exist.
 */
export function asyncList<T>(input: AsyncInput<T[]>, o: AsyncListOptions<T>): TemplateResult {
  const src = toAsyncSource(input);
  const items = (): T[] => {
    const d = src.data();
    return Array.isArray(d) ? d : [];
  };
  const placeholder = (): View => {
    const e = src.error();
    if (e !== undefined) return o.error ? o.error(e) : defaultError(e);
    const d = src.data();
    const p = src.pending();
    if (p && d === undefined) return o.pending ? o.pending() : "";
    // Resolved but no rows → empty (only once not pending, so a first load shows pending).
    if (!p && (d === undefined || (Array.isArray(d) && d.length === 0))) return o.empty ? o.empty() : "";
    return "";
  };
  return html`${list(items, o.key, o.render)}${() => placeholder()}`;
}

export interface StreamListOptions<T> {
  key: (item: T, i: number) => string | number;
  render: (item: T) => TemplateResult;
  empty?: () => View;
}

/**
 * Bind directly to a streamFeed-like Accessor<T[]>. This is the "no re-render per
 * message" primitive: the feed delivers ONE coalesced array per flush and `list`
 * diffs by key, so only new/changed keys call render() and touch the DOM. The
 * empty state is a separate reactive child that reads length, so it never forces
 * the row list to rebuild.
 */
export function streamList<T>(items: Accessor<T[]> | (() => T[]), o: StreamListOptions<T>): TemplateResult {
  const read = items as () => T[];
  return html`${list(read, o.key, o.render)}${() => (read().length === 0 && o.empty ? o.empty() : "")}`;
}
