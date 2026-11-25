// AUDIT PoC — L2 + L10, edge adapter.
//   L2: htmlResponse must emit safe default security headers (nosniff etc.),
//       caller-overridable.
//   L10: toWebRequest must not blindly trust Host / X-Forwarded-Proto — a malformed
//        Host (not a plain authority) poisons the Request URL; reject it → loopback.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, request, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { htmlResponse, createEdgeHandler, nodeListener } from "../src/edge.ts";

test("L2: htmlResponse sets safe default security headers (caller can override)", () => {
  const r = htmlResponse("<h1>hi</h1>");
  assert.equal(r.headers.get("x-content-type-options"), "nosniff");
  assert.equal(r.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  assert.equal(r.headers.get("content-type"), "text/html; charset=utf-8");
  // Caller-supplied value wins.
  const o = htmlResponse("<h1>hi</h1>", { headers: { "referrer-policy": "no-referrer" } });
  assert.equal(o.headers.get("referrer-policy"), "no-referrer");
});

// Drive a real node server so Host / X-Forwarded-Proto flow through toWebRequest.
function serve(): Promise<{ port: number; server: Server }> {
  // The handler echoes the Request URL the edge adapter built from the headers.
  const handler = createEdgeHandler({
    "/echo": (req) => new Response(new URL(req.url).host + "|" + new URL(req.url).protocol),
  });
  const server = createServer(nodeListener(handler));
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve({ port: (server.address() as AddressInfo).port, server })),
  );
}
function get(port: number, headers: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port, path: "/echo", headers }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.end();
  });
}

test("L10: a malformed Host is rejected (URL falls back to loopback)", async () => {
  const { port, server } = await serve();
  try {
    // A Host with a path segment is a valid header value but NOT a plain authority.
    const poisoned = await get(port, { Host: "attacker.example/evil" });
    assert.ok(!poisoned.includes("attacker.example"), `injected Host must not reach the URL — got: ${poisoned}`);
    assert.ok(poisoned.startsWith("127.0.0.1"), `falls back to loopback — got: ${poisoned}`);
    // A well-formed Host IS honoured.
    const ok = await get(port, { Host: "example.test:8080" });
    assert.ok(ok.startsWith("example.test:8080"), `valid Host honoured — got: ${ok}`);
  } finally {
    server.close();
  }
});

test("L10: X-Forwarded-Proto is constrained to http/https", async () => {
  const { port, server } = await serve();
  try {
    const injected = await get(port, { Host: "example.test", "x-forwarded-proto": "javascript" });
    assert.ok(injected.endsWith("http:"), `bogus proto ignored → http — got: ${injected}`);
    const https = await get(port, { Host: "example.test", "x-forwarded-proto": "https" });
    assert.ok(https.endsWith("https:"), `valid https honoured — got: ${https}`);
  } finally {
    server.close();
  }
});
