import { test } from "node:test";
import assert from "node:assert/strict";
import * as http2 from "node:http2";
import type { AddressInfo } from "node:net";

import { createGrpcChannel } from "../src/grpc.ts";
import type { GrpcError } from "../src/grpc.ts";

// gRPC length-prefix helpers (mirror of the client's framing) for the test server.
function frame(payload: Uint8Array): Buffer {
  const out = Buffer.alloc(5 + payload.byteLength);
  out[0] = 0;
  out.writeUInt32BE(payload.byteLength, 1);
  Buffer.from(payload).copy(out, 5);
  return out;
}

function deframe(buf: Buffer): Buffer {
  const length = buf.readUInt32BE(1);
  return buf.subarray(5, 5 + length);
}

interface Behaviour {
  // "ok" echoes the request bytes with grpc-status 0 trailer.
  // "fail" sends grpc-status 7 (PERMISSION_DENIED) + grpc-message trailer.
  mode: "ok" | "fail";
}

async function startServer(behaviour: Behaviour): Promise<{ url: string; close: () => Promise<void> }> {
  const server = http2.createServer();

  server.on("stream", (stream, headers) => {
    assert.equal(headers[":method"], "POST");
    assert.equal(headers["content-type"], "application/grpc+proto");
    assert.equal(headers["te"], "trailers");

    const chunks: Buffer[] = [];
    stream.on("data", (c: Buffer) => chunks.push(c));
    stream.on("end", () => {
      const req = Buffer.concat(chunks);
      const payload = deframe(req);

      if (behaviour.mode === "fail") {
        // Trailers-only style: respond, then emit the error status as trailers.
        stream.respond(
          { "content-type": "application/grpc+proto", ":status": 200 },
          { waitForTrailers: true },
        );
        stream.on("wantTrailers", () =>
          stream.sendTrailers({
            "grpc-status": "7",
            "grpc-message": encodeURIComponent("access denied"),
          }),
        );
        stream.end();
        return;
      }

      // OK: echo the payload in a length-prefixed frame + grpc-status 0 trailer.
      stream.respond(
        { "content-type": "application/grpc+proto", ":status": 200 },
        { waitForTrailers: true },
      );
      stream.on("wantTrailers", () => stream.sendTrailers({ "grpc-status": "0" }));
      stream.write(frame(payload));
      stream.end();
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

test("grpc unary round-trips bytes with grpc-status 0", async () => {
  const srv = await startServer({ mode: "ok" });
  try {
    const channel = createGrpcChannel({ url: srv.url });
    const request = new Uint8Array([1, 2, 3, 4, 5]);
    const reply = await channel.unary("dx.Echo", "Call", request, { deadlineMs: 5000 });
    assert.deepEqual([...reply], [1, 2, 3, 4, 5]);
  } finally {
    await srv.close();
  }
});

test("grpc unary throws GrpcError with .code on non-zero trailer", async () => {
  const srv = await startServer({ mode: "fail" });
  try {
    const channel = createGrpcChannel({ url: srv.url });
    await assert.rejects(
      () => channel.unary("dx.Echo", "Call", new Uint8Array([9]), { deadlineMs: 5000 }),
      (err: GrpcError) => {
        assert.equal(err.code, 7);
        assert.equal(err.details, "access denied");
        assert.ok(/gRPC error 7/.test(err.message));
        return true;
      },
    );
  } finally {
    await srv.close();
  }
});
