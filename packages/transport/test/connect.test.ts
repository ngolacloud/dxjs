import { test } from "node:test";
import assert from "node:assert/strict";
import { createConnectClient, type ConnectError } from "../src/index.ts";

function fakeFetch(handler: (url: string, init: RequestInit) => { status?: number; body?: unknown }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const { status = 200, body = {} } = handler(url, init);
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

test("unary POSTs to /service/method with the Connect header", async () => {
  const { fn, calls } = fakeFetch(() => ({ body: { total: 3 } }));
  const client = createConnectClient({ baseUrl: "/rpc", auth: () => "t", fetch: fn });
  const res = await client.unary<{ page: number }, { total: number }>("catalog.v1.Catalog", "List", { page: 0 });
  assert.deepEqual(res, { total: 3 });
  assert.equal(calls[0].url, "/rpc/catalog.v1.Catalog/List");
  const h = calls[0].init.headers as Record<string, string>;
  assert.equal(h["connect-protocol-version"], "1");
  assert.equal(h["authorization"], "Bearer t");
  assert.equal(calls[0].init.method, "POST");
});

test("error response throws a typed ConnectError with code", async () => {
  const { fn } = fakeFetch(() => ({ status: 403, body: { code: "permission_denied", message: "nope" } }));
  const client = createConnectClient({ fetch: fn });
  await assert.rejects(
    () => client.unary("S", "M", {}),
    (e: ConnectError) => {
      assert.equal(e.name, "ConnectError");
      assert.equal(e.code, "permission_denied");
      assert.equal(e.message, "nope");
      return true;
    },
  );
});
