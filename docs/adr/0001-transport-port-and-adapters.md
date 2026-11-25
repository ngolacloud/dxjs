# ADR 0001 — Protocol-agnostic transport: port + adapters

> **Status:** ACCEPTED
> **Date:** 2026-11-25
> **Upstream context:** [DESIGN.md](../../DESIGN.md) §7 (transport), [docs/parity/react-parity.md](../parity/react-parity.md)
> **Decides:** how dxjs talks to any backend.

---

## 1. Context

dxjs started as the native frontend of **Seiva** (a Rust services framework), but
the owner's directive is explicit: **dxjs must serve any backend**, and it must
work in two deployment modes:

- **Separate** from Seiva (or any backend) — talks over the **public API** (network).
- **Embedded** in Seiva (served by the binary and/or running in SSR, co-located) —
  talks over **in-process RPC, fast and secure** (no network hop, no public surface).

"Any backend" also means **any protocol**: REST/JSON, gRPC (native and
gRPC-web/Connect), SOAP, and the embedded in-process channel — with real-time
**streaming** where the protocol allows it.

Today `@dxjs/transport` already has pieces (REST `createClient`, `resource`,
`createLiveSource` multiplexed SSE, `createConnectClient`) and `@dxjs/edge` has
native gRPC over `node:http2` — but **each is its own API**. Application code,
`@dxjs/query` and `@dxjs/forms` end up coupled to *one* protocol. Changing backend
or deployment mode forces a rewrite of the call sites.

## 2. Decision

Adopt a **hexagonal architecture at the transport boundary**: a **port** (a
minimal, neutral interface) that everything else consumes, and **adapters** (one
per protocol) that implement it. The protocol becomes a bootstrap detail;
application code never sees it.

```
app · @dxjs/query · @dxjs/forms · resource · codegen
                      │ depend only on ↓
                 ┌──────────────┐
                 │   Transport  │  (the PORT — fixed by this ADR)
                 └──────────────┘
                      ▲  implemented by
   ┌──────┬───────────┼───────────┬──────────┬───────────┐
  REST  Connect   native gRPC    SOAP     embedded      SSE/WS
 (http) (grpc-web) (node:http2) (xml/http) (in-process) (stream)
```

**Seiva stops being the core** and becomes **a profile** on top of the port
(see §7). Any other backend brings its own profile and inherits the same
guarantees.

## 3. The fixed contract

These are the stable shapes. Adapters and profiles depend on **only** these.

### 3.1 Method descriptor (IDL-neutral)

Normalizes any IDL (OpenAPI, protobuf, WSDL, the Seiva registry) into one shape
the port can execute.

```ts
export type MethodKind = "unary" | "serverStream";

export interface MethodDescriptor<Req = unknown, Res = unknown> {
  /** Stable, unique method id (e.g. "accounts.create"). */
  readonly id: string;
  /** Logical service/resource (e.g. "accounts"). */
  readonly service: string;
  /** Method name (e.g. "create"). */
  readonly method: string;
  readonly kind: MethodKind;
  /** Hints each adapter maps to its protocol (never read by the app):
   *  REST → {http:{method:"POST", path:"/v1/accounts"}}; gRPC → {grpc:{...}}; etc. */
  readonly wire?: Readonly<Record<string, unknown>>;
  /** Idempotent mutation? Enables safe retry + idempotency-key. */
  readonly idempotent?: boolean;
  /** Type-only anchors (erased at runtime) — the codegen pins Req/Res here. */
  readonly __req?: Req;
  readonly __res?: Res;
}
```

### 3.2 Call context (shared, cross-cutting policy)

```ts
export interface CallCtx {
  /** Cancellation (tied to the owner tree — aborts on unmount). */
  signal?: AbortSignal;
  /** Neutral metadata/headers; each adapter translates (headers, gRPC metadata…). */
  meta?: Record<string, string>;
  /** Credential to inject (Bearer, mTLS ref, session token). */
  auth?: AuthToken;
  /** Trace propagation (W3C traceparent) for correlation with observability. */
  traceId?: string;
  /** Idempotency key for mutations (safe resend). */
  idempotencyKey?: string;
  /** Per-call timeout (ms). */
  timeoutMs?: number;
}
```

### 3.3 The PORT

```ts
export interface Transport {
  /** Request→response call. */
  unary<Req, Res>(method: MethodDescriptor<Req, Res>, req: Req, ctx?: CallCtx): Promise<Res>;
  /** Server→client stream (push); the basis of `liveSignal`/real-time. */
  serverStream<Req, Res>(method: MethodDescriptor<Req, Res>, req: Req, ctx?: CallCtx): AsyncIterable<Res>;
  /** What this adapter can do (for negotiation — §5). */
  readonly caps: TransportCaps;
}

export interface TransportCaps {
  serverStream: boolean;  // native streaming? (gRPC-stream, SSE)
  bidi: boolean;          // bidirectional? (WS, gRPC-bidi)
  binary: boolean;        // binary payload? (protobuf, embedded) vs JSON/text only
  inProcess: boolean;     // no network (embedded)
}
```

### 3.4 Adapter = `Transport` factory

```ts
export type Adapter = (options: unknown) => Transport;
// restAdapter({ baseUrl })  ·  connectAdapter({ baseUrl })
// grpcNativeAdapter({ authority })  ·  soapAdapter({ endpoint, wsdl })
// embeddedAdapter({ invoke })  ·  (sseAdapter/wsAdapter feed serverStream)
```

### 3.5 Interceptors (policy lives on the port, not in the protocol)

Auth, retry, trace and logging are **middleware** over the port — identical on
every adapter:

```ts
export type Interceptor = (next: Transport) => Transport;
export function withInterceptors(base: Transport, ...mw: Interceptor[]): Transport;
// e.g. withInterceptors(rest, authInterceptor(session), retry({ max: 3, jitter: true }), tracing())
```

### 3.6 Typed client over the port

```ts
export function createClient(transport: Transport): {
  call<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx?: CallCtx): Promise<Res>;
  live<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx?: CallCtx): AsyncIterable<Res>;
};
```

`resource()`, `@dxjs/query` and `@dxjs/forms` now take a `Transport` (or a
`createClient`), **never** `fetch` nor a protocol.

## 4. Adapters (matrix)

| Protocol | Adapter | Package | IDL → descriptor | Environment |
|---|---|---|---|---|
| REST/JSON | `restAdapter` | `@dxjs/transport` (exists) | OpenAPI | browser + node |
| gRPC-web/Connect | `connectAdapter` | `@dxjs/transport` (exists) | protobuf | browser + node |
| native gRPC | `grpcNativeAdapter` | `@dxjs/edge` (exists) | protobuf | node/edge |
| SOAP | `soapAdapter` | `@dxjs/soap` (new) | WSDL | browser(HTTPS)+node |
| **embedded RPC** | `embeddedAdapter` | `@dxjs/embedded` (new) | backend registry | **server/SSR** |
| real-time | `sseAdapter`/`wsAdapter` | `@dxjs/transport` (SSE exists) | — | browser + node |

**Embedded mode (the fast, secure path).** When dxjs runs inside/next to Seiva
(SSR, co-located, or served by the binary), `embeddedAdapter({ invoke })` calls the
handler directly — in-process or over a local unix socket — against the same
service registry:

```ts
// `invoke` is supplied by the host (Seiva): dispatches the descriptor to the real handler.
const embedded = embeddedAdapter({ invoke: (m, req, ctx) => seivaDispatch(m.id, req, ctx) });
```

- **Fast:** no HTTP round-trip, no public serialization (zero-copy where possible).
- **Secure:** the API is not exposed on the network; a trusted channel by construction.

The **same app** runs over `embeddedAdapter` (embedded) and over `restAdapter`/
`connectAdapter` (separate) — only the bootstrap swaps.

## 5. Capability negotiation and graceful degradation

`liveSignal`/real-time inspects `transport.caps` and picks the best path, always
behind the **same** API:

```
native serverStream (gRPC-stream)  →  else SSE  →  else long-poll
```

Application code calls `client.live(descriptor, req)` and gets a `liveSignal`; it
neither knows nor cares which mechanism runs underneath.

## 6. Security per adapter, shared policy

- **Browser (strict CSP):** no `eval`/inline; REST/Connect/SOAP over `fetch`/HTTPS;
  token via interceptor; Trusted Types respected.
- **node/edge:** mTLS, native gRPC, SOAP over TCP.
- **Embedded:** trusted in-process channel — no network exposure.
- Cross-cutting (on the port, via interceptors): auth injection, `traceparent`
  propagation, `idempotencyKey`, timeouts, retry with backoff+jitter.

## 7. Seiva as a profile (not the core)

`@dxjs/seiva` sits **on top of** the port and holds only what is Seiva-specific:

1. codegen `/openapi.json` (+ WireSchema) → typed `MethodDescriptor`s + `@dxjs/forms` validators;
2. mapping the Seiva **error envelope** → the `@dxjs/transport` error model
   (fields→forms, 401/403 scope/BOLA, 409/412 DORM optimistic concurrency);
3. wiring Seiva **events** (command bus) to `serverStream` → `@dxjs/query` invalidation.

All of it runs over **any** adapter — so `embeddedAdapter` (embedded) and
`restAdapter` (separate) give identical behaviour. Another backend writes its own
profile (a generic `@dxjs/openapi`, or a gRPC profile) and inherits the same
primitives.

## 8. Consequences

**Positive**
- One backend/protocol/deployment mode ⇒ swap the adapter, zero app changes.
- The embedded path delivers minimal latency and **no network surface**.
- The core stays tiny: adapters are **opt-in and tree-shakeable** (a REST-only app
  ships no SOAP/gRPC).
- `@dxjs/query`/`forms`/`resource` test against a trivial fake `Transport`.

**Costs / honest limits**
- **The browser cannot speak everything:** native gRPC, SOAP-over-TCP and the
  in-process `embeddedAdapter` are **server-side** (SSR/edge); in the browser it is
  REST, Connect/gRPC-web and SOAP-over-HTTPS. The port is the same; the `caps`
  differ (hence §5).
- One extra indirection in the transport (mitigated: the port is thin; interceptors are opt-in).
- Normalizing each IDL into `MethodDescriptor` is per-protocol codegen work.

## 9. Alternatives considered

1. **One client per protocol (status quo).** Rejected: couples the app to the
   protocol; switching backend/mode rewrites call sites.
2. **REST only + "the rest is a gateway's problem".** Rejected: loses the fast,
   secure embedded path and native gRPC/stream; pushes latency and an extra hop.
3. **Adopt an external SDK (e.g. Connect-ES) as the base.** Rejected as the *core*:
   it would add a dependency and weight; it remains **one** possible adapter, not the port.

## 10. Implementation plan (follow-up sessions, out of this ADR)

1. Extract the `Transport` port + `MethodDescriptor` + `CallCtx`; reconduct
   `resource`/`query`/`forms` to depend only on it; rewrap the existing REST/Connect/
   native-gRPC as adapters (without breaking the current API).
2. `embeddedAdapter` (in-process) + capability negotiation (§5).
3. `@dxjs/codegen` (neutral): OpenAPI → descriptors (protobuf/WSDL next).
4. `@dxjs/seiva` profile (§7), proven against the real `admin-e2e` on **two adapters**
   (REST remote *and* embedded) with the **same** app code — the proof that the
   architecture is correct.
