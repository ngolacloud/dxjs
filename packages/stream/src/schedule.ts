// @dxjs/stream/schedule — batched flush scheduler.
//
// Coalesces many push()-driven flush requests into ONE run() per cadence tick, so
// a burst of stream messages triggers a single visible update instead of one per
// message. Three cadences:
//   "microtask" — end-of-tick, lowest latency; dedupe via a scheduled flag.
//   "raf"       — align to a paint; falls back to microtask off-DOM (Node/SSR).
//   number (ms) — trailing debounce: a run fires `ms` after the LAST request in a
//                 burst, so a continuous burst collapses to a single trailing run.
// request() is idempotent while a flush is pending (microtask/raf); cancel() clears
// any pending flush so a queued callback cannot fire late after teardown.

export type FlushMode = "microtask" | "raf" | number;

export interface Scheduler {
  request(): void;
  cancel(): void;
}

/** Build a scheduler for `mode` whose pending flush invokes `run`. */
export function makeScheduler(mode: FlushMode, run: () => void): Scheduler {
  if (mode === "microtask") {
    let scheduled = false;
    const flush = (): void => {
      // cancel() clears the flag, so a microtask already queued becomes a no-op.
      if (!scheduled) return;
      scheduled = false;
      run();
    };
    return {
      request(): void {
        if (scheduled) return; // idempotent while a flush is pending
        scheduled = true;
        queueMicrotask(flush);
      },
      cancel(): void {
        scheduled = false;
      },
    };
  }

  if (mode === "raf") {
    const g = globalThis as {
      requestAnimationFrame?: (cb: FrameRequestCallback) => number;
      cancelAnimationFrame?: (h: number) => void;
    };
    const raf = g.requestAnimationFrame;
    // No frame clock off-DOM: degrade to microtask so the path stays exercisable.
    if (!raf) return makeScheduler("microtask", run);
    const caf = g.cancelAnimationFrame;
    let handle: number | null = null;
    return {
      request(): void {
        if (handle !== null) return; // idempotent while a frame is pending
        handle = raf(() => {
          handle = null;
          run();
        });
      },
      cancel(): void {
        if (handle !== null) {
          caf?.(handle);
          handle = null;
        }
      },
    };
  }

  // number: trailing debounce. Each request resets the timer so a steady burst
  // coalesces into a single run once it quiets down (`mode` ms of silence).
  const ms = mode;
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    request(): void {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        run();
      }, ms);
    },
    cancel(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
    },
  };
}
