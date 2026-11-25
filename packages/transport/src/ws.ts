// @dxjs/transport/ws — WebSocket adapter for the Transport port (ADR 0001).
//
// A server-streaming (and bidi-capable) adapter: it opens a WebSocket, sends the
// request as JSON on open so the server can scope the subscription, then yields
// each incoming message as parsed JSON (falling back to the raw string). It is
// stream-only — compose it with restAdapter for unary. CSP-safe: no eval, no
// innerHTML, plain WebSocket events bridged to an async generator.

import {
  type Transport,
  type MethodDescriptor,
  type CallCtx,
  type AuthToken,
  transportError,
} from "./port.ts";

export interface WsAdapterOptions {
  /** ws:// or wss:// base URL. */
  url: string;
  /** Sub-protocols to request on the handshake. */
  protocols?: string | string[];
  /** Injectable WebSocket constructor for tests (defaults to the global). */
  WebSocket?: typeof WebSocket;
  /** Credential for the subscription. Browsers cannot set an `Authorization`
   *  header on a WebSocket handshake, so the adapter sends an authentication
   *  frame `{ type: "authorization", authorization: "Bearer <token>" }` as the
   *  FIRST message on open, before the request frame. The server MUST authenticate
   *  that frame and emit nothing until it validates — a configured credential is
   *  always transmitted, never silently dropped (M9). */
  auth?: AuthToken;
}

/** Resolve a static or lazy credential to a non-empty string, else undefined. */
function resolveAuth(auth: AuthToken | undefined): string | undefined {
  const v = typeof auth === "function" ? auth() : auth;
  return v || undefined;
}

/** An adapter whose `serverStream` opens a WebSocket, sends the request as JSON on
 *  open, then yields each incoming message parsed as JSON (raw string on parse
 *  failure). The stream ends when the socket closes, throws on a socket error, and
 *  closes the socket + ends when `ctx.signal` aborts. */
export function wsAdapter(options: WsAdapterOptions): Transport {
  return {
    caps: { serverStream: true, bidi: true, binary: false, inProcess: false },
    unary(): Promise<never> {
      throw transportError("unimplemented", "wsAdapter is stream-only; compose with restAdapter for unary");
    },
    async *serverStream<Req, Res>(_m: MethodDescriptor<Req, Res>, req: Req, ctx: CallCtx = {}): AsyncIterable<Res> {
      const WS = options.WebSocket ?? WebSocket;
      const ws = new WS(options.url, options.protocols);

      // Bridge the event-based socket to the generator: a FIFO queue of messages
      // plus a single pending resolver that the event handlers wake.
      const queue: unknown[] = [];
      let resolve: (() => void) | undefined;
      let closed = false;
      let error: unknown;

      const wake = (): void => {
        const r = resolve;
        resolve = undefined;
        r?.();
      };

      ws.onopen = (): void => {
        // Authenticate FIRST (before the request): a configured credential must be
        // transmitted, not ignored (M9). The server validates this frame before
        // honouring the subscription request that follows.
        const token = resolveAuth(options.auth);
        if (token) ws.send(JSON.stringify({ type: "authorization", authorization: "Bearer " + token }));
        // Send the request so the server can scope the subscription.
        ws.send(JSON.stringify(req));
      };
      ws.onmessage = (ev: MessageEvent): void => {
        let parsed: unknown = (ev as { data?: unknown }).data;
        try {
          parsed = JSON.parse((ev as { data: string }).data);
        } catch {
          /* a non-JSON frame: yield the raw payload */
        }
        queue.push(parsed);
        wake();
      };
      ws.onclose = (): void => {
        closed = true;
        wake();
      };
      ws.onerror = (): void => {
        error = transportError("stream", "WebSocket error");
        closed = true;
        wake();
      };

      const onAbort = (): void => {
        closed = true;
        try {
          ws.close();
        } catch {
          /* already closing/closed */
        }
        wake();
      };
      if (ctx.signal) {
        if (ctx.signal.aborted) onAbort();
        else ctx.signal.addEventListener("abort", onAbort, { once: true });
      }

      try {
        while (!closed || queue.length) {
          if (queue.length) {
            yield queue.shift() as Res;
          } else {
            await new Promise<void>((r) => {
              resolve = r;
            });
          }
        }
        if (error) throw error;
      } finally {
        ctx.signal?.removeEventListener("abort", onAbort);
        try {
          ws.close();
        } catch {
          /* already closing/closed */
        }
      }
    },
  };
}
