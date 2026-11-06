// @dxjs/query — cached, deduped, stale-while-revalidate async queries.
//
// The signal-reactive answer to react-query: a QueryClient holds a key→entry
// cache; `query()` subscribes an observer to an entry, returns its data/error/
// fetching as signals, and triggers a fetch only when the entry is stale.
// Concurrent queries for the same key share ONE in-flight promise (dedupe). Cached
// data is returned immediately while a background refetch runs (stale-while-
// revalidate). `invalidate(key)` marks entries stale and refetches live ones.
//
// No eval, no globals on window; built on @dxjs/core signals. Fetcher-agnostic —
// pass any `() => Promise<T>` (fetch, a @dxjs/transport Client, gRPC, …).

import { signal, onCleanup, untrack, type Accessor } from "@dxjs/core";

/** A query key: a string, or an array serialised deterministically. */
export type QueryKey = string | readonly unknown[];

export interface QueryOptions<T> {
  /** Seed the cache before the first fetch resolves. */
  initialData?: T;
  /** How long (ms) cached data is considered fresh; within it, no refetch on a
   *  new observer. Default 0 (always revalidate on mount). Use Infinity to pin. */
  staleTime?: number;
}

/** The reactive handle a `query()` returns. Call it (or `.data()`) for the value. */
export interface Query<T> extends Accessor<T | undefined> {
  data: Accessor<T | undefined>;
  error: Accessor<unknown>;
  /** True until the first successful (or failed) load completes. */
  isLoading: Accessor<boolean>;
  /** True whenever a fetch (initial or background) is in flight. */
  isFetching: Accessor<boolean>;
  /** Force a refetch of this key now. */
  refetch(): Promise<void>;
}

interface Entry<T = unknown> {
  key: string;
  data: ReturnType<typeof signal<T | undefined>>;
  error: ReturnType<typeof signal<unknown>>;
  isFetching: ReturnType<typeof signal<boolean>>;
  hasData: ReturnType<typeof signal<boolean>>;
  fetcher: () => Promise<T>;
  promise: Promise<void> | null; // in-flight (for dedupe)
  updatedAt: number; // ms epoch of last successful load (0 = never/stale)
  observers: number;
  staleTime: number;
}

export interface QueryClient {
  /** Mark matching entries stale and refetch those with live observers.
   *  A string/array key matches by prefix (so ["todos"] invalidates
   *  ["todos", 1], ["todos", 2], …). */
  invalidate(key: QueryKey): Promise<void>;
  /** Warm the cache for `key` without an observer. */
  prefetch<T>(key: QueryKey, fetcher: () => Promise<T>, options?: QueryOptions<T>): Promise<void>;
  /** Read cached data for `key` without subscribing (undefined if absent). */
  getData<T>(key: QueryKey): T | undefined;
  /** Write cached data for `key` (optimistic updates); notifies observers. */
  setData<T>(key: QueryKey, data: T): void;
  /** Drop everything from the cache. */
  clear(): void;
  /** @internal */
  _query<T>(key: QueryKey, fetcher: () => Promise<T>, options?: QueryOptions<T>): Query<T>;
}

/** Deterministic string key (stable across property order for plain objects). */
export function keyOf(key: QueryKey): string {
  if (typeof key === "string") return key;
  return JSON.stringify(key, (_k, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.keys(v as Record<string, unknown>)
          .sort()
          .reduce((o, k) => ((o[k] = (v as Record<string, unknown>)[k]), o), {} as Record<string, unknown>)
      : v,
  );
}

const now = (): number => (typeof Date !== "undefined" ? Date.now() : 0);

/** Create a query client (one cache). Pass it to {@link query}. */
export function createQueryClient(): QueryClient {
  const cache = new Map<string, Entry>();

  const ensure = <T>(key: string, fetcher: () => Promise<T>, staleTime: number, initialData?: T): Entry<T> => {
    let e = cache.get(key) as Entry<T> | undefined;
    if (!e) {
      e = {
        key,
        data: signal<T | undefined>(initialData),
        error: signal<unknown>(undefined),
        isFetching: signal(false),
        hasData: signal(initialData !== undefined),
        fetcher,
        promise: null,
        updatedAt: initialData !== undefined ? now() : 0,
        observers: 0,
        staleTime,
      };
      cache.set(key, e as Entry);
    } else {
      e.fetcher = fetcher; // keep the latest fetcher closure
      e.staleTime = staleTime;
    }
    return e;
  };

  const runFetch = <T>(e: Entry<T>): Promise<void> => {
    if (e.promise) return e.promise; // dedupe concurrent fetches for this key
    untrack(() => e.isFetching.set(true));
    const p = e
      .fetcher()
      .then(
        (d) => {
          untrack(() => {
            e.data.set(d);
            e.hasData.set(true);
            e.error.set(undefined);
            e.updatedAt = now();
          });
        },
        (err) => {
          untrack(() => e.error.set(err));
        },
      )
      .finally(() => {
        e.promise = null;
        untrack(() => e.isFetching.set(false));
      });
    e.promise = p;
    return p;
  };

  const isStale = (e: Entry): boolean => e.updatedAt === 0 || now() - e.updatedAt >= e.staleTime;

  const client: QueryClient = {
    async invalidate(key) {
      const prefix = keyOf(key);
      const jobs: Promise<void>[] = [];
      for (const e of cache.values()) {
        if (matchesPrefix(e.key, prefix)) {
          e.updatedAt = 0; // stale
          if (e.observers > 0) jobs.push(runFetch(e));
        }
      }
      await Promise.all(jobs);
    },
    async prefetch(key, fetcher, options = {}) {
      const e = ensure(keyOf(key), fetcher, options.staleTime ?? 0, options.initialData);
      if (isStale(e)) await runFetch(e);
    },
    getData(key) {
      const e = cache.get(keyOf(key));
      return e ? (untrack(() => e.data()) as never) : undefined;
    },
    setData(key, data) {
      const k = keyOf(key);
      const e = cache.get(k);
      if (e) {
        untrack(() => {
          e.data.set(data);
          e.hasData.set(true);
          e.updatedAt = now();
        });
      }
    },
    clear() {
      cache.clear();
    },
    _query<T>(key: QueryKey, fetcher: () => Promise<T>, options: QueryOptions<T> = {}): Query<T> {
      const e = ensure(keyOf(key), fetcher, options.staleTime ?? 0, options.initialData);
      e.observers++;
      onCleanup(() => {
        e.observers--;
      });
      // Trigger a (deduped) fetch if the entry is stale. SWR: any cached data is
      // already exposed via e.data while this runs in the background.
      if (isStale(e)) void runFetch(e);

      const q = (() => e.data()) as Query<T>;
      q.data = () => e.data();
      q.error = () => e.error();
      q.isFetching = () => e.isFetching();
      q.isLoading = () => e.isFetching() && !e.hasData();
      q.refetch = () => {
        e.updatedAt = 0;
        return runFetch(e);
      };
      return q;
    },
  };
  return client;
}

/** Prefix match for array keys: ["todos"] matches ["todos",1] etc. */
function matchesPrefix(entryKey: string, prefix: string): boolean {
  if (prefix.endsWith("]")) {
    // array prefix: strip the closing bracket so ["todos"] → ["todos" matches ["todos",1]
    const open = prefix.slice(0, -1);
    return entryKey === prefix || entryKey.startsWith(open + ",") || entryKey === open + "]";
  }
  return entryKey === prefix;
}

/**
 * Observe an async query. Returns a reactive {@link Query}; reads of `.data()`
 * (or calling it) subscribe the caller. Cached + deduped + stale-while-revalidate
 * via `client`. Call inside a component so its observer is released on unmount.
 */
export function query<T>(
  client: QueryClient,
  key: QueryKey,
  fetcher: () => Promise<T>,
  options?: QueryOptions<T>,
): Query<T> {
  return client._query(key, fetcher, options);
}
