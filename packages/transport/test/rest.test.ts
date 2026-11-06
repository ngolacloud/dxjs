import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient, type HttpError } from "../src/index.ts";

function fakeFetch(handler: (url: string, init: RequestInit) => { status?: number; body?: unknown }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const { status = 200, body = null } = handler(url, init);
    return new Response(body == null ? "" : JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

test("GET parses JSON, applies baseUrl + query + bearer", async () => {
  const { fn, calls } = fakeFetch(() => ({ body: { ok: true } }));
  const api = createClient({ baseUrl: "/v1", auth: () => "tok", fetch: fn });
  const r = await api.get<{ ok: boolean }>("/users", { query: { page: 2, q: "a" } });
  assert.deepEqual(r, { ok: true });
  assert.equal(calls[0].url, "/v1/users?page=2&q=a");
  assert.equal((calls[0].init.headers as Record<string, string>)["authorization"], "Bearer tok");
});

test("POST sends a JSON body", async () => {
  const { fn, calls } = fakeFetch(() => ({ status: 201, body: { id: 1 } }));
  const api = createClient({ fetch: fn });
  const r = await api.post<{ id: number }>("/users", { name: "Ana" });
  assert.deepEqual(r, { id: 1 });
  assert.equal(calls[0].init.body, JSON.stringify({ name: "Ana" }));
});

test("non-2xx throws a typed HttpError carrying status + body", async () => {
  const { fn } = fakeFetch(() => ({ status: 403, body: { title: "Forbidden" } }));
  const api = createClient({ fetch: fn });
  await assert.rejects(
    () => api.get("/secret"),
    (e: HttpError) => {
      assert.equal(e.name, "HttpError");
      assert.equal(e.status, 403);
      assert.equal(e.message, "Forbidden");
      assert.deepEqual(e.body, { title: "Forbidden" });
      return true;
    },
  );
});

test("forwards the AbortSignal to fetch", async () => {
  const { fn, calls } = fakeFetch(() => ({ body: {} }));
  const api = createClient({ fetch: fn });
  const ac = new AbortController();
  await api.get("/x", { signal: ac.signal });
  assert.equal(calls[0].init.signal, ac.signal);
});
