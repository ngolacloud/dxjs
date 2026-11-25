// @dxjs/proto — protobuf/gRPC service mapping for the @dxjs/transport port.
//
// Maps a protobuf SERVICE descriptor into Transport MethodDescriptors (ADR 0001).
// This is the service MAP only; payload encoding is the caller's codec on
// grpcNativeAdapter / connectAdapter. See ./proto.ts for details.

export {
  protoServices,
  fromFileDescriptorJson,
  type ProtoMethod,
  type ProtoService,
  type ProtoResult,
  type FileDescriptorJson,
} from "./proto.ts";
