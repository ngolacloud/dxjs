// @dxjs/edge — runtime-agnostic Web-fetch HTTP handler (edge/server) with
// injectable SSR, plus a native HTTP/2 gRPC unary client that reads trailers.
// See ../../../DESIGN.md (§8).

export { createEdgeHandler, htmlResponse, nodeListener } from "./edge.ts";
export type {
  EdgeHandler,
  FetchHandler,
  Routes,
  HtmlResponseOptions,
} from "./edge.ts";

export { createGrpcChannel } from "./grpc.ts";
export type {
  GrpcChannel,
  GrpcChannelOptions,
  GrpcUnaryOptions,
  GrpcError,
} from "./grpc.ts";

// ADR 0001 — native-gRPC adapter for the @dxjs/transport port.
export { grpcNativeAdapter } from "./grpc-adapter.ts";
export type { GrpcCodec, GrpcNativeAdapterOptions } from "./grpc-adapter.ts";
