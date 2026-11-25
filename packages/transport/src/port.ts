// @dxjs/transport/port — the protocol-neutral transport boundary (ADR 0001).
//
// Everything that fetches data (resource, @dxjs/query, @dxjs/forms submit handlers,
// a future codegen) depends ONLY on `Transport`, never on `fetch` nor on a protocol.
// Concrete protocols (REST, Connect/gRPC-web, native gRPC, SOAP, in-process) are
// adapters that implement this port (see ./adapters.ts). Auth, retry and tracing
// are interceptors over the port, so they work the same on every adapter.

/** A pre-request→response call vs a server→client stream. */
export type MethodKind = "unary" | "serverStream";

/** A credential: a bearer string, or a provider called per request. */
export type AuthToken = string | (() => string | null | undefined);

/** An IDL-neutral method description. A codegen (OpenAPI/protobuf/WSDL/registry)
 *  produces these; adapters read `wire` to map to their protocol. The app never
 *  reads `wire`. */
export interface MethodDescriptor<Req = unknown, Res = unknown> {
  /** Stable, unique id, e.g. "accounts.create". */
  readonly id: string;
  /** Logical service/resource, e.g. "accounts". */
  readonly service: string;
  /** Method name, e.g. "create". */
  readonly method: string;
  readonly kind: MethodKind;
  /** Per-protocol hints, e.g. { http: { method: "POST", path: "/v1/accounts" } }. */
  readonly wire?: Readonly<Record<string, unknown>>;
  /** Idempotent mutation? Enables safe retry + idempotency-key. */
  readonly idempotent?: boolean;
  /** Type-only anchors (erased at runtime) so callers get Req/Res inference. */
  readonly __req?: Req;
  readonly __res?: Res;
}

/** Cross-cutting, protocol-neutral per-call context. */
export interface CallCtx {
  /** Cancellation (resource ties this to the owner → aborts on unmount). */
  signal?: AbortSignal;
  /** Neutral metadata/headers; each adapter translates to its wire form. */
  meta?: Record<string, string>;
  /** Credential to inject. */
  auth?: AuthToken;
  /** W3C traceparent, propagated for observability correlation. */
  traceId?: string;
  /** Idempotency key for a safe mutation resend. */
  idempotencyKey?: string;
  /** Per-call timeout in ms. */
  timeoutMs?: number;
}

/** What an adapter is able to do (for capability negotiation). */
export interface TransportCaps {
  /** Native server→client streaming (gRPC-stream, SSE). */
  serverStream: boolean;
  /** Bidirectional streaming (WebSocket, gRPC-bidi). */
  bidi: boolean;
  /** Binary payloads (protobuf, in-process) vs JSON/text only. */
  binary: boolean;
  /** No network hop (embedded / in-process). */
  inProcess: boolean;
}

/** The port. Adapters implement it; everything else consumes it. */
export interface Transport {
  unary<Req, Res>(method: MethodDescriptor<Req, Res>, req: Req, ctx?: CallCtx): Promise<Res>;
  serverStream<Req, Res>(method: MethodDescriptor<Req, Res>, req: Req, ctx?: CallCtx): AsyncIterable<Res>;
  readonly caps: TransportCaps;
}

/** A transport-layer error carrying a stable `code` (adapters may throw their own
 *  typed errors too; the unified error model is a later slice). */
export interface TransportError extends Error {
  code: string;
}
export function transportError(code: string, message: string): TransportError {
  const err = new Error(message) as TransportError;
  err.name = "TransportError";
  err.code = code;
  return err;
}

// --- Descriptor builder ----------------------------------------------------
/** Build a `MethodDescriptor`. `service`/`method` default from a dotted `id`
 *  ("accounts.create" → service "accounts", method "create"); `kind` defaults to
 *  "unary". */
export function method<Req = unknown, Res = unknown>(spec: {
  id: string;
  service?: string;
  method?: string;
  kind?: MethodKind;
  wire?: Readonly<Record<string, unknown>>;
  idempotent?: boolean;
}): MethodDescriptor<Req, Res> {
  const dot = spec.id.lastIndexOf(".");
  const service = spec.service ?? (dot > 0 ? spec.id.slice(0, dot) : spec.id);
  const name = spec.method ?? (dot > 0 ? spec.id.slice(dot + 1) : spec.id);
  return {
    id: spec.id,
    service,
    method: name,
    kind: spec.kind ?? "unary",
    wire: spec.wire,
    idempotent: spec.idempotent,
  };
}

// --- Interceptors ----------------------------------------------------------
/** Wraps a Transport to add cross-cutting behaviour (auth, retry, tracing…). */
export type Interceptor = (next: Transport) => Transport;

/** Compose interceptors over a base transport. The first listed is the OUTERMOST
 *  (runs first on the way in). */
export function withInterceptors(base: Transport, ...mw: Interceptor[]): Transport {
  return mw.reduceRight((next, m) => m(next), base);
}

// --- Typed client over the port --------------------------------------------
export interface RpcClient {
  call<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx?: CallCtx): Promise<Res>;
  live<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx?: CallCtx): AsyncIterable<Res>;
}

/** A thin typed facade over a Transport. (ADR 0001 names this `createClient`; while
 *  REST's `createClient` still exists it ships as `createRpcClient` to avoid a
 *  breaking rename — a future major, once REST is only an adapter, reclaims the
 *  short name.) */
export function createRpcClient(transport: Transport): RpcClient {
  return {
    call: (m, req, ctx) => transport.unary(m, req, ctx),
    live: (m, req, ctx) => transport.serverStream(m, req, ctx),
  };
}

// --- Glue for resource()/query/forms ---------------------------------------
/** Turn a (transport, method, request) into a `resource()` fetcher. Pass an
 *  accessor for `req` to make the resource reactive (it re-runs when a signal the
 *  accessor reads changes). */
export function fromMethod<Req, Res>(
  transport: Transport,
  m: MethodDescriptor<Req, Res>,
  req: Req | (() => Req),
  ctx?: CallCtx,
): (signal: AbortSignal) => Promise<Res> {
  return (signal) => transport.unary(m, typeof req === "function" ? (req as () => Req)() : req, { ...ctx, signal });
}
