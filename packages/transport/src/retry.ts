// @dxjs/transport/retry — shared resilience primitives: a per-attempt timeout
// (an AbortSignal that fires on its own, composable with the caller's signal)
// plus exponential backoff between attempts. Kept tiny and dependency-free so
// both the REST client and the reactive resource can reuse it.

export interface ResilienceOptions {
  /** Per-attempt timeout in ms. The attempt's fetch is aborted when it elapses.
   *  0/undefined = no timeout. */
  timeout?: number;
  /** Extra attempts after the first, on a retriable failure. Default 0. */
  retries?: number;
  /** Base backoff in ms; grows exponentially (base * 2^(attempt-1)). Default 0. */
  backoff?: number;
  /** Whether retrying is safe. A retry re-runs the operation, so for a fetcher with
   *  non-idempotent side effects (a POST/PATCH) replaying it risks a double write.
   *  Set `false` to suppress retries even when `retries > 0`. Defaults vary by caller
   *  (a read-like `resource` assumes `true`; the REST client gates per HTTP method). */
  idempotent?: boolean;
}

/** Compose the caller's signal (if any) with a fresh per-attempt timeout signal.
 *  Returns the signal to pass to fetch; undefined when neither applies. */
export function attemptSignal(outer: AbortSignal | undefined, timeout: number): AbortSignal | undefined {
  const timed = timeout > 0 ? AbortSignal.timeout(timeout) : undefined;
  if (outer && timed) return AbortSignal.any([outer, timed]);
  return outer ?? timed;
}

/** Resolve after the backoff for `attempt` (1-based). Zero base → next tick.
 *  Interruptible: if `signal` aborts mid-sleep, resolve at once instead of
 *  waiting out the full delay (the caller then sees the abort on its next step). */
export function backoffDelay(base: number, attempt: number, signal?: AbortSignal): Promise<void> {
  const ms = base > 0 ? base * 2 ** (attempt - 1) : 0;
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const done = (): void => {
      clearTimeout(t);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const t = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
  });
}
