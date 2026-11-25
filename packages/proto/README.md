# @dxjs/proto

Map a protobuf/gRPC **service descriptor** into [`@dxjs/transport`](../transport)
`MethodDescriptor`s (ADR 0001). A whole service becomes typed descriptors — ids,
service/method names, `wire.grpc` hints and idempotency — in one call.

## Scope (read this first)

This package is a **service MAP, not a wire codec.** It does **not** serialize or
deserialize protobuf messages. Request/response payload **encoding** is the
caller's codec (e.g. [`protobuf-es`](https://github.com/bufbuild/protobuf-es))
plugged into `grpcNativeAdapter` / `connectAdapter`. Those adapters read the
`wire.grpc` hint from the descriptors produced here to address the RPC; the app
never touches `wire`.

Think of it as the gRPC twin of `@dxjs/openapi`: same `{ methods, method(id) }`
shape, just sourced from a protobuf service instead of an OpenAPI document.

## Usage

```ts
import { protoServices } from "@dxjs/proto";

const svc = protoServices({
  name: "greet.Greeter",
  methods: [
    { name: "SayHello" },
    { name: "Watch", responseStream: true },                 // → kind "serverStream"
    { name: "List", idempotencyLevel: "NO_SIDE_EFFECTS" },    // → idempotent
  ],
});

svc.method("greet.Greeter.SayHello"); // MethodDescriptor
svc.method("SayHello");                // bare name works when unambiguous
svc.method("nope");                    // throws: proto: no method "nope"
```

### From a protoc / protobuf-es descriptor dump

A build step can feed a minimal `FileDescriptorProto`-ish JSON (snake_case, as
emitted by protoc / protobuf-es) straight in — no `.proto` text parsing required:

```ts
import { fromFileDescriptorJson } from "@dxjs/proto";

const svc = fromFileDescriptorJson({
  package: "greet",
  service: [{
    name: "Greeter",
    method: [
      { name: "SayHello" },
      { name: "Watch", server_streaming: true },
    ],
  }],
});
// → greet.Greeter.SayHello (unary), greet.Greeter.Watch (serverStream)
```

Unknown fields are ignored; missing names are skipped.

## Mapping rules

| protobuf                              | `MethodDescriptor`                          |
| ------------------------------------- | ------------------------------------------- |
| service `name` + rpc `name`           | `id = "Service.Method"`, keyed both ways\*  |
| `server_streaming`                    | `kind: "serverStream"` (else `"unary"`)     |
| `client_streaming`                    | downgraded — the port has no client-stream kind; drive it via the codec/adapter |
| `idempotency_level` ∈ {`IDEMPOTENT`, `NO_SIDE_EFFECTS`} | `idempotent: true`        |
| service + method                      | `wire: { grpc: { service, method } }`       |

\* Both `"Service.Method"` and the bare `"Method"` are registered; the bare key
is dropped when two services share a method name (ambiguous).

## License

MIT OR Apache-2.0
