// @dxjs/transport — REST, reactive resources, multiplexed SSE, Connect (gRPC).
// See ../../../DESIGN.md (§7).

export { createClient } from "./rest.ts";
export type { Client, ClientOptions, RequestOptions, HttpError } from "./rest.ts";

export { resource } from "./resource.ts";
export type { Resource, ResourceOptions } from "./resource.ts";

export { createLiveSource } from "./sse.ts";
export type { LiveSource, LiveSourceConfig, TopicOptions } from "./sse.ts";

export { createConnectClient } from "./connect.ts";
export type { ConnectClient, ConnectOptions, ConnectCallOptions, ConnectError } from "./connect.ts";

// ADR 0001 — the protocol-neutral transport port + adapters.
export { method, withInterceptors, createRpcClient, fromMethod, transportError } from "./port.ts";
export type {
  Transport, MethodDescriptor, MethodKind, CallCtx, TransportCaps, AuthToken,
  Interceptor, RpcClient, TransportError,
} from "./port.ts";
export { restAdapter, connectAdapter, inMemoryAdapter, embeddedAdapter } from "./adapters.ts";
export type { HttpWire, Handler, InMemoryOptions, EmbeddedOptions } from "./adapters.ts";

export { liveSignal } from "./live.ts";
export type { LiveSignal, LiveOptions } from "./live.ts";
