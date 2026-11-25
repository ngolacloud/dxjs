// @dxjs/edge/grpc-adapter — the native-gRPC adapter for the Transport port
// (ADR 0001). It wraps the HTTP/2 `GrpcChannel` behind the port so app code and
// resource/query/forms reach gRPC through the same seam as REST/Connect/embedded.
//
// gRPC is binary, so a `codec` encodes the request object to bytes and decodes the
// reply bytes — supply a protobuf codec in production (a JSON codec works for tests
// and for JSON-over-gRPC backends). Native gRPC is a server/edge path (Node
// HTTP/2); the browser uses the Connect adapter instead.

import { createGrpcChannel, type GrpcChannel, type GrpcChannelOptions } from "./grpc.ts";
import {
  transportError,
  type Transport,
  type MethodDescriptor,
  type CallCtx,
  type TransportCaps,
} from "@dxjs/transport";

/** Encodes/decodes a method's request/reply to the bytes gRPC carries. */
export interface GrpcCodec {
  encode(method: MethodDescriptor, req: unknown): Uint8Array;
  decode(method: MethodDescriptor, bytes: Uint8Array): unknown;
}

export interface GrpcNativeAdapterOptions extends GrpcChannelOptions {
  codec: GrpcCodec;
  /** Injectable channel (tests / alternate transport); defaults to createGrpcChannel. */
  channel?: GrpcChannel;
}

const CAPS: TransportCaps = { serverStream: false, bidi: false, binary: true, inProcess: false };

/** gRPC service/method override carried on a descriptor's `wire.grpc`. */
interface GrpcWire {
  service?: string;
  method?: string;
}

/** An adapter over the native HTTP/2 gRPC channel. */
export function grpcNativeAdapter(o: GrpcNativeAdapterOptions): Transport {
  const channel = o.channel ?? createGrpcChannel(o);
  return {
    caps: CAPS,
    async unary<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx: CallCtx = {}): Promise<Res> {
      const grpc = (m.wire?.grpc ?? {}) as GrpcWire;
      const service = grpc.service ?? m.service;
      const name = grpc.method ?? m.method;
      const bytes = o.codec.encode(m, req);
      const out = await channel.unary(service, name, bytes, { deadlineMs: ctx.timeoutMs });
      return o.codec.decode(m, out) as Res;
    },
    serverStream(): AsyncIterable<never> {
      throw transportError("unimplemented", "grpcNativeAdapter: server streaming is a later increment");
    },
  };
}
