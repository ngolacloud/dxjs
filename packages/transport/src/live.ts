// @dxjs/transport/live — a reactive live value over the Transport port, with
// capability negotiation (ADR 0001 §5). ONE API: if the transport advertises a
// native server stream (gRPC-stream, SSE, embedded) it consumes it; otherwise it
// degrades to polling the unary call. The signal is owner-tied — the stream is
// aborted / the poll cleared on unmount — and re-subscribes when a reactive `req`
// changes.

import { signal, effect, onCleanup, untrack, type Accessor } from "@dxjs/core";
import type { Transport, MethodDescriptor, CallCtx } from "./port.ts";

export interface LiveSignal<Res> extends Accessor<Res | undefined> {
  /** Last error, if the stream/poll failed. */
  error: Accessor<unknown>;
  /** Stop the subscription (also runs automatically on owner dispose). */
  stop(): void;
}

export interface LiveOptions<Res> {
  initial?: Res;
  /** Poll interval (ms) used only when the transport has no native stream. Default 2000. */
  pollMs?: number;
  ctx?: CallCtx;
}

/** Subscribe to a method as a reactive signal. Native `serverStream` when the
 *  transport supports it; otherwise poll `unary` every `pollMs`. Pass an accessor
 *  for `req` to re-subscribe when a dependency changes. */
export function liveSignal<Req, Res>(
  transport: Transport,
  m: MethodDescriptor<Req, Res>,
  req: Req | (() => Req),
  opts: LiveOptions<Res> = {},
): LiveSignal<Res> {
  const value = signal<Res | undefined>(opts.initial);
  const error = signal<unknown>(undefined);
  const readReq = (): Req => (typeof req === "function" ? (req as () => Req)() : req);

  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  let gen = 0;

  const stop = (): void => {
    gen++;
    if (controller) {
      controller.abort();
      controller = null;
    }
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
  };

  const start = (): void => {
    stop();
    const my = gen; // stop() just bumped gen; a later stop() invalidates this run
    controller = new AbortController();
    const r = readReq();

    if (transport.caps.serverStream) {
      const ctx: CallCtx = { ...opts.ctx, signal: controller.signal };
      void (async () => {
        try {
          for await (const v of transport.serverStream(m, r, ctx)) {
            if (my !== gen) return;
            untrack(() => value.set(v));
          }
        } catch (e) {
          if (my === gen && !controller?.signal.aborted) untrack(() => error.set(e));
        }
      })();
    } else {
      const poll = async (): Promise<void> => {
        try {
          const v = await transport.unary(m, r, { ...opts.ctx });
          if (my === gen) untrack(() => value.set(v));
        } catch (e) {
          if (my === gen) untrack(() => error.set(e));
        }
      };
      void poll();
      timer = setInterval(() => void poll(), opts.pollMs ?? 2000);
    }
  };

  // Re-subscribe when a signal read by `req` changes; start() runs untracked so the
  // subscription internals don't become dependencies.
  effect(() => {
    readReq();
    untrack(start);
  });
  onCleanup(stop);

  const acc = (() => value()) as LiveSignal<Res>;
  acc.error = () => error();
  acc.stop = stop;
  return acc;
}
