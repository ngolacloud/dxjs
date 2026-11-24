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
  // A composed signal (caller ⊕ timeout) is passed; with no timeout it is the
  // caller's signal verbatim.
  assert.equal(calls[0].init.signal, ac.signal);
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(body == null ? "" : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("retries after a network failure, then succeeds", async () => {
  let n = 0;
  const fn = (async () => {
    n++;
    if (n === 1) throw new TypeError("network down");
    return jsonResponse(200, { ok: true });
  }) as unknown as typeof fetch;
  const api = createClient({ fetch: fn, retries: 1, backoff: 0 });
  const r = await api.get<{ ok: boolean }>("/x");
  assert.deepEqual(r, { ok: true });
  assert.equal(n, 2, "one retry after the failed attempt");
});

test("retries a transient 503, then surfaces the recovered body", async () => {
  let n = 0;
  const fn = (async () => {
    n++;
    return n < 3 ? jsonResponse(503, { title: "down" }) : jsonResponse(200, { v: 1 });
  }) as unknown as typeof fetch;
  const api = createClient({ fetch: fn, retries: 3, backoff: 0 });
  const r = await api.get<{ v: number }>("/x");
  assert.deepEqual(r, { v: 1 });
  assert.equal(n, 3, "retried twice before the 200");
});

test("does NOT retry a 4xx client error", async () => {
  let n = 0;
  const fn = (async () => {
    n++;
    return jsonResponse(404, { title: "Not Found" });
  }) as unknown as typeof fetch;
  const api = createClient({ fetch: fn, retries: 5, backoff: 0 });
  await assert.rejects(() => api.get("/x"), (e: HttpError) => e.status === 404);
  assert.equal(n, 1, "a 404 is final — no retries");
});

test("a per-attempt timeout aborts the request", async () => {
  let aborted = false;
  // Never resolves on its own; rejects only when the (timeout) signal fires.
  const fn = (async (_url: string, init: RequestInit = {}) =>
    new Promise<Response>((_resolve, reject) => {
      const sig = init.signal;
      if (sig)
        sig.addEventListener("abort", () => {
          aborted = true;
          reject(sig.reason ?? new Error("aborted"));
        });
    })) as unknown as typeof fetch;
  const api = createClient({ fetch: fn, timeout: 20 });
  await assert.rejects(() => api.get("/slow"));
  assert.equal(aborted, true, "the attempt's fetch saw the timeout abort");
});

test("timeout is per-attempt: a hung try is retried and the next one succeeds", async () => {
  let n = 0;
  const fn = (async (_url: string, init: RequestInit = {}) => {
    n++;
    if (n === 1)
      return new Promise<Response>((_res, reject) => {
        init.signal?.addEventListener("abort", () => reject(init.signal?.reason ?? new Error("to")));
      });
    return jsonResponse(200, { ok: true });
  }) as unknown as typeof fetch;
  const api = createClient({ fetch: fn, timeout: 20, retries: 1, backoff: 0 });
  const r = await api.get<{ ok: boolean }>("/x");
  assert.deepEqual(r, { ok: true });
  assert.equal(n, 2, "first attempt timed out and was retried");
});
