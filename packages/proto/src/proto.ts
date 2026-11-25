// @dxjs/proto/proto — map a protobuf/gRPC service descriptor into Transport
// MethodDescriptors (ADR 0001). This mirrors the `openapi()` shape: give it a
// service (or a list), get back `{ methods, method(id) }` keyed descriptors.
//
// SCOPE: this is a service MAP, not a wire codec. We do NOT serialize protobuf
// messages here. Request/response payload ENCODING is the caller's codec (e.g.
// protobuf-es) plugged into grpcNativeAdapter / connectAdapter; those adapters
// read `wire.grpc` from the descriptors produced here to address the RPC. The
// app never reads `wire`.

import { method, type MethodDescriptor } from "@dxjs/transport";

/** A single RPC within a protobuf service. */
export interface ProtoMethod {
  /** RPC method name, e.g. "GetUser". */
  name: string;
  /** Client-streaming RPC. The unary/serverStream port has no client-stream
   *  kind, so such a method is still mapped to a descriptor but DOWNGRADED to the
   *  nearest representable kind (unary, or serverStream when bidi) — the caller
   *  must drive client-stream framing through the codec/adapter itself. */
  requestStream?: boolean;
  /** Server-streaming RPC → MethodKind "serverStream". */
  responseStream?: boolean;
  /** protobuf method idempotency option. */
  idempotencyLevel?: "IDEMPOTENT" | "NO_SIDE_EFFECTS" | "IDEMPOTENCY_UNKNOWN";
}

/** A protobuf service: a fully-qualified name and its RPCs. */
export interface ProtoService {
  /** Fully-qualified service name, e.g. "greet.Greeter". */
  name: string;
  /** Optional protobuf package (informational; `name` is used as the service id). */
  package?: string;
  methods: ProtoMethod[];
}

export interface ProtoResult {
  /** Descriptors keyed by "Service.Method" and (when unambiguous) the bare "Method". */
  methods: Record<string, MethodDescriptor>;
  /** The descriptor for an id (throws if unknown). */
  method(id: string): MethodDescriptor;
}

function isIdempotent(level?: ProtoMethod["idempotencyLevel"]): boolean {
  return level === "NO_SIDE_EFFECTS" || level === "IDEMPOTENT";
}

/** Map one or more protobuf services into Transport MethodDescriptors.
 *
 *  Each service × method becomes a descriptor with id "Service.Method",
 *  `wire.grpc = { service, method }`, kind "serverStream" for server-streaming
 *  RPCs (else "unary"), and `idempotent` from the protobuf idempotency option.
 *
 *  Both the qualified key "Service.Method" and the bare "Method" are registered;
 *  a bare key is dropped when two services share a method name (ambiguous).
 *
 *  Payload encoding is NOT handled here — see the file header. */
export function protoServices(services: ProtoService | ProtoService[]): ProtoResult {
  const list = Array.isArray(services) ? services : [services];
  const methods: Record<string, MethodDescriptor> = {};
  // Track bare names so we can drop ambiguous ones (same method in 2 services).
  const bareCount = new Map<string, number>();

  for (const svc of list) {
    for (const rpc of svc.methods) {
      const id = `${svc.name}.${rpc.name}`;
      const descriptor = method({
        id,
        service: svc.name,
        method: rpc.name,
        kind: rpc.responseStream ? "serverStream" : "unary",
        wire: { grpc: { service: svc.name, method: rpc.name } },
        idempotent: isIdempotent(rpc.idempotencyLevel),
      });
      methods[id] = descriptor;
      bareCount.set(rpc.name, (bareCount.get(rpc.name) ?? 0) + 1);
      // Register the bare key provisionally; prune ambiguous ones afterwards.
      methods[rpc.name] = descriptor;
    }
  }

  // Remove bare keys that collide across services (keep only qualified ids).
  for (const [name, count] of bareCount) {
    if (count > 1) delete methods[name];
  }

  return {
    methods,
    method(id) {
      const m = methods[id];
      if (!m) throw new Error(`proto: no method "${id}"`);
      return m;
    },
  };
}

/** A minimal protobuf FileDescriptorProto-ish JSON (snake_case, as emitted by
 *  protoc / protobuf-es). Unknown fields are ignored. */
export interface FileDescriptorJson {
  package?: string;
  service?: Array<{
    name?: string;
    method?: Array<{
      name?: string;
      input_type?: string;
      output_type?: string;
      client_streaming?: boolean;
      server_streaming?: boolean;
      options?: { idempotency_level?: ProtoMethod["idempotencyLevel"] };
    }>;
  }>;
}

/** Normalize a FileDescriptorProto-ish JSON into ProtoService[] and map it.
 *
 *  Service ids are fully-qualified ("<package>.<ServiceName>") when a package is
 *  present. Lenient: missing names are skipped, unknown fields ignored. This lets
 *  a build step feed descriptors straight from protoc/protobuf-es without us
 *  parsing .proto text. */
export function fromFileDescriptorJson(json: FileDescriptorJson): ProtoResult {
  const pkg = json.package;
  const services: ProtoService[] = [];

  for (const svc of json.service ?? []) {
    if (!svc?.name) continue;
    const qualified = pkg ? `${pkg}.${svc.name}` : svc.name;
    const methods: ProtoMethod[] = [];
    for (const m of svc.method ?? []) {
      if (!m?.name) continue;
      methods.push({
        name: m.name,
        requestStream: m.client_streaming,
        responseStream: m.server_streaming,
        idempotencyLevel: m.options?.idempotency_level,
      });
    }
    services.push({ name: qualified, package: pkg, methods });
  }

  return protoServices(services);
}
