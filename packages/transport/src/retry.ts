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
}

/** Compose the caller's signal (if any) with a fresh per-attempt timeout signal.
 *  Returns the signal to pass to fetch; undefined when neither applies. */
export function attemptSignal(outer: AbortSignal | undefined, timeout: number): AbortSignal | undefined {
  const timed = timeout > 0 ? AbortSignal.timeout(timeout) : undefined;
  if (outer && timed) return AbortSignal.any([outer, timed]);
  return outer ?? timed;
}

/** Resolve after the backoff for `attempt` (1-based). Zero base → next tick. */
export function backoffDelay(base: number, attempt: number): Promise<void> {
  const ms = base > 0 ? base * 2 ** (attempt - 1) : 0;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
