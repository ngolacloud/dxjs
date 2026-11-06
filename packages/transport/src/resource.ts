// @dxjs/transport/resource — a reactive async value tied to the component owner.
//
// The fetcher receives an AbortSignal. The resource re-runs when a signal it
// reads synchronously changes, ABORTING the previous request, and a generation
// guard ensures a late/stale response can never overwrite a newer one. On owner
// dispose (unmount) the in-flight request is aborted.

import { signal, effect, onCleanup, untrack, type Accessor } from "@dxjs/core";

export interface Resource<T> extends Accessor<T | undefined> {
  loading: Accessor<boolean>;
  error: Accessor<unknown>;
  refetch(): void;
}

export interface ResourceOptions<T> {
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
  let controller: AbortController | null = null;
  let gen = 0;

  const run = (): void => {
    const my = ++gen;
    if (controller) controller.abort();
    controller = new AbortController();
    const sig = controller.signal;
    // Writes are untracked so they don't make the effect depend on its own state.
    untrack(() => {
      loading.set(true);
      error.set(undefined);
    });
    fetcher(sig).then(
      (v) => {
        if (my !== gen || sig.aborted) return;
        data.set(v);
        loading.set(false);
      },
      (e) => {
        if (my !== gen || sig.aborted) return;
        error.set(e);
        loading.set(false);
      },
    );
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
