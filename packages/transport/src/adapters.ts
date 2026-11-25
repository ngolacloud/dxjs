// @dxjs/transport/adapters — protocol adapters for the Transport port (ADR 0001).
//
// Each adapter wraps an existing client (or an in-process handler map) behind the
// same `Transport` interface, so the app code and resource/query/forms are
// identical regardless of protocol. Adapters are opt-in and tree-shakeable.

import { createClient, type ClientOptions, type RequestOptions } from "./rest.ts";
import { createConnectClient, type ConnectOptions } from "./connect.ts";
import {
  type Transport,
  type TransportCaps,
  type MethodDescriptor,
  type CallCtx,
  type AuthToken,
  transportError,
} from "./port.ts";

const NO_STREAM: TransportCaps = { serverStream: false, bidi: false, binary: false, inProcess: false };

function resolveAuth(auth: AuthToken | undefined): string | undefined {
  const v = typeof auth === "function" ? auth() : auth;
  return v || undefined;
}

// --- REST adapter ----------------------------------------------------------
/** HTTP mapping hints carried on a descriptor's `wire.http`. */
export interface HttpWire {
  method?: string;
  /** Literal path, or a function of the request (for path params). */
  path?: string | ((req: unknown) => string);
  /** For GET/HEAD/DELETE: send the request object as the query string. */
  query?: boolean;
}

/** An adapter over the typed REST client. Reads `method.wire.http` to map a
 *  descriptor to an HTTP call; `ctx` carries signal/auth/trace/idempotency. */
export function restAdapter(options: ClientOptions = {}): Transport {
  const client = createClient(options);
  return {
    caps: NO_STREAM,
    unary<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx: CallCtx = {}): Promise<Res> {
      const http = (m.wire?.http ?? {}) as HttpWire;
      const verb = (http.method ?? (m.idempotent ? "GET" : "POST")).toUpperCase();
      const path = typeof http.path === "function" ? http.path(req) : (http.path ?? `/${m.service}/${m.method}`);
      const headers: Record<string, string> = { ...(ctx.meta ?? {}) };
      const token = resolveAuth(ctx.auth);
      if (token) headers["authorization"] = "Bearer " + token;
      if (ctx.traceId) headers["traceparent"] = ctx.traceId;
      if (ctx.idempotencyKey) headers["idempotency-key"] = ctx.idempotencyKey;
      const sendBody = verb !== "GET" && verb !== "HEAD" && verb !== "DELETE";
      const ro: RequestOptions = { signal: ctx.signal, headers, idempotent: m.idempotent, timeout: ctx.timeoutMs };
      if (!sendBody && http.query && req && typeof req === "object") {
        ro.query = req as RequestOptions["query"];
      }
      return client.request<Res>(verb, path, sendBody ? req : undefined, ro);
    },
    serverStream(): AsyncIterable<never> {
      throw transportError("unimplemented", "restAdapter has no serverStream; use SSE/WS for real-time");
    },
  };
}

// --- Connect (gRPC-web) adapter --------------------------------------------
/** An adapter over the Connect unary (JSON) client. */
export function connectAdapter(options: ConnectOptions = {}): Transport {
  const client = createConnectClient(options);
  return {
    caps: NO_STREAM,
    unary<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx: CallCtx = {}): Promise<Res> {
      return client.unary<Req, Res>(m.service, m.method, req, { signal: ctx.signal });
    },
    serverStream(): AsyncIterable<never> {
      throw transportError("unimplemented", "connectAdapter is unary-only for now");
    },
  };
}

// --- In-memory / in-process adapter ----------------------------------------
/** A handler returns a value (unary) or an async iterable (serverStream). */
export type Handler<Req = unknown, Res = unknown> = (
  req: Req,
  ctx: CallCtx,
) => Res | Promise<Res> | AsyncIterable<Res>;

export interface InMemoryOptions {
  /** Keyed by `MethodDescriptor.id`. */
  handlers: Record<string, Handler>;
  caps?: Partial<TransportCaps>;
}

/** An in-process adapter: dispatches to a local handler map, no network. It is the
 *  test double for the port AND the precursor of the embedded adapter (which swaps
 *  the handler map for the host backend's dispatch). */
export function inMemoryAdapter(o: InMemoryOptions): Transport {
  const find = <Req, Res>(m: MethodDescriptor<Req, Res>): Handler<Req, Res> => {
    const h = o.handlers[m.id];
    if (!h) throw transportError("unimplemented", `no in-memory handler for "${m.id}"`);
    return h as Handler<Req, Res>;
  };
  return {
    caps: { serverStream: true, bidi: false, binary: true, inProcess: true, ...o.caps },
    async unary<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx: CallCtx = {}): Promise<Res> {
      return (await find(m)(req, ctx)) as Res;
    },
    async *serverStream<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx: CallCtx = {}): AsyncIterable<Res> {
      const out = await find(m)(req, ctx);
      yield* out as AsyncIterable<Res>;
    },
  };
}
