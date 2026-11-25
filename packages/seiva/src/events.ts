// @dxjs/seiva/events — turn Seiva command-bus events (consumed over the port's
// serverStream) into @dxjs/query invalidation, so the UI stays consistent with the
// backend without polling. Owner-tied: the subscription aborts on dispose.

import { onCleanup } from "@dxjs/core";
import type { Transport, MethodDescriptor, CallCtx } from "@dxjs/transport";
import type { QueryClient, QueryKey } from "@dxjs/query";

/** A minimal Seiva domain event shape. Extra fields are allowed. */
export interface SeivaEvent {
  type: string;
  resource?: string;
  id?: string | number;
  [k: string]: unknown;
}

export interface LiveInvalidationHandle {
  stop(): void;
}

export interface LiveInvalidationOptions<Req> {
  /** Request sent to open the event stream (default {}). */
  req?: Req;
  ctx?: CallCtx;
}

/** Subscribe to `eventsMethod` (a server stream of events) and invalidate the query
 *  keys that `toKeys` returns for each event. Returns a handle to stop manually; it
 *  also stops on owner dispose. */
export function liveInvalidation<E = SeivaEvent, Req = unknown>(
  transport: Transport,
  eventsMethod: MethodDescriptor<Req, E>,
  client: QueryClient,
  toKeys: (event: E) => QueryKey[],
  options: LiveInvalidationOptions<Req> = {},
): LiveInvalidationHandle {
  const controller = new AbortController();
  const stop = (): void => controller.abort();

  void (async () => {
    const ctx: CallCtx = { ...options.ctx, signal: controller.signal };
    try {
      for await (const event of transport.serverStream(eventsMethod, (options.req ?? {}) as Req, ctx)) {
        for (const key of toKeys(event)) void client.invalidate(key);
      }
    } catch {
      // Stream aborted (stop/dispose) or ended — nothing to do.
    }
  })();

  onCleanup(stop);
  return { stop };
}
