import { test } from "node:test";
import assert from "node:assert/strict";
import { protoServices, fromFileDescriptorJson } from "../src/index.ts";

test("protoServices maps a service into keyed descriptors", () => {
  const r = protoServices({
    name: "greet.Greeter",
    methods: [
      { name: "SayHello" },
      { name: "Watch", responseStream: true },
      { name: "List", idempotencyLevel: "NO_SIDE_EFFECTS" },
    ],
  });

  const hello = r.method("greet.Greeter.SayHello");
  assert.equal(hello.service, "greet.Greeter");
  assert.equal(hello.method, "SayHello");
  assert.equal(hello.kind, "unary");
  const wire = hello.wire as { grpc: { service: string; method: string } };
  assert.equal(wire.grpc.service, "greet.Greeter");
  assert.equal(wire.grpc.method, "SayHello");

  assert.equal(r.method("greet.Greeter.Watch").kind, "serverStream");
  assert.equal(r.method("greet.Greeter.List").idempotent, true);

  // Bare key resolves (unambiguous within this service).
  assert.equal(r.method("SayHello").id, "greet.Greeter.SayHello");
});

test("method(id) throws for an unknown id", () => {
  const r = protoServices({ name: "greet.Greeter", methods: [{ name: "SayHello" }] });
  assert.throws(() => r.method("nope"), /no method/);
});

test("idempotencyLevel IDEMPOTENT is also idempotent", () => {
  const r = protoServices({ name: "svc.S", methods: [{ name: "Put", idempotencyLevel: "IDEMPOTENT" }] });
  assert.equal(r.method("svc.S.Put").idempotent, true);
});

test("ambiguous bare keys are dropped, qualified ids remain", () => {
  const r = protoServices([
    { name: "a.A", methods: [{ name: "Do" }] },
    { name: "b.B", methods: [{ name: "Do" }] },
  ]);
  assert.ok(r.method("a.A.Do"));
  assert.ok(r.method("b.B.Do"));
  assert.throws(() => r.method("Do"), /no method/);
});

test("fromFileDescriptorJson normalizes snake_case descriptors", () => {
  const r = fromFileDescriptorJson({
    package: "greet",
    service: [
      {
        name: "Greeter",
        method: [{ name: "SayHello" }, { name: "Watch", server_streaming: true }],
      },
    ],
  });

  assert.equal(r.method("greet.Greeter.SayHello").service, "greet.Greeter");
  assert.equal(r.method("greet.Greeter.Watch").kind, "serverStream");
  // Bare key still works when unambiguous.
  assert.equal(r.method("Watch").kind, "serverStream");
});
