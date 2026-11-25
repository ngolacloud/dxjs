import { test } from "node:test";
import assert from "node:assert/strict";
import { method } from "@dxjs/transport";
import { grpcNativeAdapter, type GrpcCodec } from "../src/index.ts";
import type { GrpcChannel } from "../src/index.ts";

const enc = new TextEncoder();
const dec = new TextDecoder();

// A simple JSON codec (production would supply a protobuf codec).
const jsonCodec: GrpcCodec = {
  encode: (_m, req) => enc.encode(JSON.stringify(req)),
  decode: (_m, bytes) => JSON.parse(dec.decode(bytes)),
};

test("grpcNativeAdapter maps a descriptor to the channel via the codec", async () => {
  const seen: Array<{ service: string; name: string; deadlineMs?: number }> = [];
  // Fake channel: records the gRPC path and echoes { service, name, req }.
  const channel: GrpcChannel = {
    unary: async (service, name, bytes, opts) => {
      seen.push({ service, name, deadlineMs: opts?.deadlineMs });
      const req = JSON.parse(dec.decode(bytes));
      return enc.encode(JSON.stringify({ service, name, req }));
    },
  };
  const t = grpcNativeAdapter({ url: "http://unused", codec: jsonCodec, channel });

  assert.deepEqual(t.caps, { serverStream: false, bidi: false, binary: true, inProcess: false });

  const hello = method<{ name: string }, { service: string; name: string; req: { name: string } }>({
    id: "greeter.hello",
    wire: { grpc: { service: "greet.Greeter", method: "SayHello" } },
  });
  const res = await t.unary(hello, { name: "Ana" }, { timeoutMs: 1500 });

  assert.deepEqual(res, { service: "greet.Greeter", name: "SayHello", req: { name: "Ana" } });
  assert.deepEqual(seen, [{ service: "greet.Greeter", name: "SayHello", deadlineMs: 1500 }]);
});

test("grpcNativeAdapter falls back to descriptor service/method without wire.grpc", async () => {
  let path = "";
  const channel: GrpcChannel = {
    unary: async (service, name) => {
      path = `${service}/${name}`;
      return enc.encode(JSON.stringify({ ok: true }));
    },
  };
  const t = grpcNativeAdapter({ url: "http://unused", codec: jsonCodec, channel });
  const m = method<unknown, { ok: boolean }>({ id: "x", service: "pkg.Svc", method: "Call" });
  assert.deepEqual(await t.unary(m, {}), { ok: true });
  assert.equal(path, "pkg.Svc/Call");
});

test("grpcNativeAdapter serverStream is not implemented yet (throws)", () => {
  const channel: GrpcChannel = { unary: async () => enc.encode("{}") };
  const t = grpcNativeAdapter({ url: "http://unused", codec: jsonCodec, channel });
  const m = method({ id: "x.y" });
  assert.throws(() => t.serverStream(m, {}), /later increment|not implemented|streaming/i);
});
