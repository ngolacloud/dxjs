import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

import { createEdgeHandler, htmlResponse, nodeListener } from "../src/edge.ts";

const CSP = "default-src 'self'; script-src 'self'";
const PAGE = "<!doctype html><title>t</title><h1>dxjs edge</h1>";

function makeHandler() {
  return createEdgeHandler({
    "/": () => htmlResponse(PAGE, { csp: CSP }),
  });
}

test("createEdgeHandler routes a GET to an htmlResponse", async () => {
  const handler = makeHandler();
  const res = await handler(new Request("http://edge.test/"));

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
  assert.equal(res.headers.get("content-security-policy"), CSP);
  assert.equal(await res.text(), PAGE);
});

test("createEdgeHandler returns 404 for an unknown path", async () => {
  const handler = makeHandler();
  const res = await handler(new Request("http://edge.test/nope"));

  assert.equal(res.status, 404);
  assert.equal(await res.text(), "Not Found");
});

test("htmlResponse without csp omits the header and honours status", () => {
  const res = htmlResponse("<p>x</p>", { status: 201 });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get("content-security-policy"), null);
  assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
});

test("nodeListener serves the HTML + CSP from a real node:http server", async () => {
  const handler = makeHandler();
  const server = createServer(nodeListener(handler));

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/`);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "text/html; charset=utf-8");
    assert.equal(res.headers.get("content-security-policy"), CSP);
    assert.equal(await res.text(), PAGE);

    const missing = await fetch(`http://127.0.0.1:${port}/missing`);
    assert.equal(missing.status, 404);
    await missing.text();
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
  }
});
