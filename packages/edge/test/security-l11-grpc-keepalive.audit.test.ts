// AUDIT PoC — L11: createGrpcChannel opened/closed an HTTP/2 session PER unary
//   call (no pooling). `keepAlive: true` reuses ONE session across calls and
//   exposes close(); the default stays stateless (a session per call). Asserts the
//   session count observed through a counting fetchImpl.
// Run with --test-force-exit (an http2 server/session may keep the loop alive).
import { test } from "node:test";
import assert from "node:assert/strict";
import * as http2 from "node:http2";
import type { AddressInfo } from "node:net";
import { createGrpcChannel } from "../src/grpc.ts";

function frame(p: Uint8Array): Buffer {
  const out = Buffer.alloc(5 + p.byteLength);
  out.writeUInt32BE(p.byteLength, 1);
  Buffer.from(p).copy(out, 5);
  return out;
}

async function echoServer(): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http2.createServer();
  server.on("stream", (stream) => {
    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => {
      const body = Buffer.concat(chunks);
      stream.respond({ "content-type": "application/grpc+proto", ":status": 200 }, { waitForTrailers: true });
      stream.on("wantTrailers", () => stream.sendTrailers({ "grpc-status": "0" }));
      stream.write(frame(body.subarray(5))); // echo the payload back framed
      stream.end();
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((res, rej) => server.close((e) => (e ? rej(e) : res()))),
  };
}

test("L11: keepAlive reuses ONE HTTP/2 session across unary calls", async () => {
  const srv = await echoServer();
  let sessions = 0;
  const counting: typeof http2.connect = ((url: string) => {
    sessions++;
    return http2.connect(url);
  }) as typeof http2.connect;
  const ch = createGrpcChannel({ url: srv.url, keepAlive: true, fetchImpl: counting });
  try {
    await ch.unary("dx.Echo", "Call", new Uint8Array([1]), { deadlineMs: 5000 });
    await ch.unary("dx.Echo", "Call", new Uint8Array([2]), { deadlineMs: 5000 });
    assert.equal(sessions, 1, "a single pooled session served both calls");
  } finally {
    ch.close?.(); // release the pooled session
    await srv.close();
  }
});

test("L11: default (no keepAlive) opens a session per call", async () => {
  const srv = await echoServer();
  let sessions = 0;
  const counting: typeof http2.connect = ((url: string) => {
    sessions++;
    return http2.connect(url);
  }) as typeof http2.connect;
  const ch = createGrpcChannel({ url: srv.url, fetchImpl: counting });
  try {
    await ch.unary("dx.Echo", "Call", new Uint8Array([1]), { deadlineMs: 5000 });
    await ch.unary("dx.Echo", "Call", new Uint8Array([2]), { deadlineMs: 5000 });
    assert.equal(sessions, 2, "the stateless default opens one session per call");
  } finally {
    await srv.close();
  }
});
