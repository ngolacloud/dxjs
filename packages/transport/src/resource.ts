// @dxjs/transport/resource — a reactive async value tied to the component owner.
//
// The fetcher receives an AbortSignal. The resource re-runs when a signal it
// reads synchronously changes, ABORTING the previous request, and a generation
// guard ensures a late/stale response can never overwrite a newer one. On owner
// dispose (unmount) the in-flight request is aborted.

import { signal, effect, onCleanup, untrack, type Accessor } from "@dxjs/core";
import { type ResilienceOptions, attemptSignal, backoffDelay } from "./retry.ts";

export interface Resource<T> extends Accessor<T | undefined> {
  loading: Accessor<boolean>;
  error: Accessor<unknown>;
  refetch(): void;
}

export interface ResourceOptions<T> extends ResilienceOptions {
  initial?: T;
}

/** Create a reactive async resource. */
export function resource<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  options: ResourceOptions<T> = {},
): Resource<T> {
  const data = signal<T | undefined>(options.initial);
  const loading = signal(false);
  const error = signal<unknown>(undefined);
  const timeout = options.timeout ?? 0;
  // Gate retries on idempotency (symmetry with the REST client): re-running a fetcher
  // with non-idempotent side effects would double-execute it. A resource is read-like,
  // so the default is idempotent; `idempotent:false` suppresses retries entirely (M8).
  // The per-attempt `timeout` still applies — it only cancels, it never re-runs.
  const canRetry = options.idempotent ?? true;
  const retries = canRetry ? (options.retries ?? 0) : 0;
  const backoff = options.backoff ?? 0;
  let controller: AbortController | null = null;
  let gen = 0;

  const run = (): void => {
    const my = ++gen;
    if (controller) controller.abort();
    controller = new AbortController();
    const outer = controller.signal;
    // Writes are untracked so they don't make the effect depend on its own state.
    untrack(() => {
      loading.set(true);
      error.set(undefined);
    });
    // `outer` cancels the whole resource (refetch/dispose); a per-attempt
    // timeout only cancels one try and is retried while budget remains.
    const attempt = (n: number): void => {
      fetcher(attemptSignal(outer, timeout) ?? outer).then(
        (v) => {
          if (my !== gen || outer.aborted) return;
          data.set(v);
          loading.set(false);
        },
        (e) => {
          if (my !== gen || outer.aborted) return;
          if (n < retries) {
            void backoffDelay(backoff, n + 1).then(() => {
              if (my === gen && !outer.aborted) attempt(n + 1);
            });
            return;
          }
          error.set(e);
          loading.set(false);
        },
      );
    };
    attempt(0);
  };

  // Re-run when a dependency read synchronously inside `fetcher` changes.
  effect(() => {
    run();
  });
  onCleanup(() => {
    gen++;
    if (controller) controller.abort();
  });

  const accessor = (() => data()) as Resource<T>;
  accessor.loading = () => loading();
  accessor.error = () => error();
  accessor.refetch = run;
  return accessor;
}
