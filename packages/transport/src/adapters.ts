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

// --- SSE adapter (server-streaming over text/event-stream) -----------------
export interface SseAdapterOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  auth?: AuthToken;
}

/** An adapter whose `serverStream` reads a `text/event-stream` response and yields
 *  each event's JSON `data`. Stream-only (compose with restAdapter for unary); the
 *  native stream that lets `liveSignal` prefer SSE over polling. CSP-safe: plain
 *  fetch streaming, no eval, no EventSource needed (so custom headers/auth work). */
export function sseAdapter(options: SseAdapterOptions = {}): Transport {
  const base = options.baseUrl ?? "";
  return {
    caps: { serverStream: true, bidi: false, binary: false, inProcess: false },
    unary(): Promise<never> {
      throw transportError("unimplemented", "sseAdapter is stream-only; compose with restAdapter for unary");
    },
    async *serverStream<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx: CallCtx = {}): AsyncIterable<Res> {
      const f = options.fetch ?? fetch;
      const http = (m.wire?.http ?? {}) as { path?: string | ((r: unknown) => string) };
      let path = typeof http.path === "function" ? http.path(req) : (http.path ?? `/${m.service}/${m.method}`);
      if (req && typeof req === "object") {
        const qs = new URLSearchParams();
        for (const [k, v] of Object.entries(req as Record<string, unknown>)) if (v != null) qs.set(k, String(v));
        const s = qs.toString();
        if (s) path += (path.includes("?") ? "&" : "?") + s;
      }
      const headers: Record<string, string> = { accept: "text/event-stream", ...(ctx.meta ?? {}) };
      const token = resolveAuth(ctx.auth ?? options.auth);
      if (token) headers["authorization"] = "Bearer " + token;
      if (ctx.traceId) headers["traceparent"] = ctx.traceId;

      const res = await f(base + path, { headers, signal: ctx.signal });
      if (!res.ok || !res.body) throw transportError("stream", `SSE request failed (${res.status})`);
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf = (buf + dec.decode(value, { stream: true })).replace(/\r\n/g, "\n");
          let idx: number;
          while ((idx = buf.indexOf("\n\n")) >= 0) {
            const frame = buf.slice(0, idx);
            buf = buf.slice(idx + 2);
            const data = frame
              .split("\n")
              .filter((l) => l.startsWith("data:"))
              .map((l) => l.slice(5).replace(/^ /, ""))
              .join("\n");
            if (!data) continue;
            let parsed: unknown = data;
            try {
              parsed = JSON.parse(data);
            } catch {
              /* a non-JSON event: yield the raw string */
            }
            yield parsed as Res;
          }
        }
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* already released */
        }
      }
    },
  };
}

/** Compose two transports: `unary` from one adapter, `serverStream` from another
 *  (e.g. REST for calls + SSE for live). */
export function composeTransport(unaryT: Transport, streamT: Transport): Transport {
  return {
    caps: { ...unaryT.caps, serverStream: streamT.caps.serverStream, bidi: streamT.caps.bidi },
    unary: (m, req, ctx) => unaryT.unary(m, req, ctx),
    serverStream: (m, req, ctx) => streamT.serverStream(m, req, ctx),
  };
}

// --- Embedded (in-process host-dispatch) adapter ---------------------------
export interface EmbeddedOptions {
  /** The host's dispatcher (e.g. Seiva's): routes EVERY call to the real handler,
   *  in-process or over a local socket — no network, no public surface. */
  invoke: (m: MethodDescriptor, req: unknown, ctx: CallCtx) => unknown | Promise<unknown> | AsyncIterable<unknown>;
  caps?: Partial<TransportCaps>;
}

/** The embedded adapter: when dxjs runs inside/next to the backend (SSR, co-located,
 *  served by the binary), it delegates every call to the host's `invoke` — fast (no
 *  HTTP round-trip) and secure (no network exposure). The same app runs over this or
 *  over restAdapter/connectAdapter; only the bootstrap swaps. */
export function embeddedAdapter(o: EmbeddedOptions): Transport {
  return {
    caps: { serverStream: true, bidi: false, binary: true, inProcess: true, ...o.caps },
    async unary<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx: CallCtx = {}): Promise<Res> {
      return (await o.invoke(m, req, ctx)) as Res;
    },
    async *serverStream<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx: CallCtx = {}): AsyncIterable<Res> {
      yield* (await o.invoke(m, req, ctx)) as AsyncIterable<Res>;
    },
  };
}

/** An in-process adapter: dispatches to a local handler map, no network. It is the
 *  test double for the port AND a simple embedded variant (the handler map instead
 *  of a host dispatcher). */
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
