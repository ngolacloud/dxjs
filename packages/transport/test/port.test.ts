import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot, signal } from "@dxjs/core";
import { createQueryClient, query } from "@dxjs/query";
import {
  method, withInterceptors, createRpcClient, fromMethod, inMemoryAdapter, restAdapter, connectAdapter,
  resource,
  type Transport, type MethodDescriptor, type CallCtx,
} from "../src/index.ts";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function fakeFetch(handler: (url: string, init: RequestInit) => { status?: number; body?: unknown }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fn = (async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    const { status = 200, body = null } = handler(url, init);
    return new Response(body == null ? "" : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

// --- descriptor builder ----------------------------------------------------
test("method() derives service/method from a dotted id", () => {
  const m = method({ id: "accounts.create", idempotent: false });
  assert.equal(m.service, "accounts");
  assert.equal(m.method, "create");
  assert.equal(m.kind, "unary");
});

// --- in-memory adapter -----------------------------------------------------
const getUser = method<{ id: number }, { id: number; name: string }>({ id: "users.get", idempotent: true });
const ticks = method<{ n: number }, number>({ id: "clock.ticks", kind: "serverStream" });

test("inMemoryAdapter: unary dispatches to the handler; serverStream yields", async () => {
  const t = inMemoryAdapter({
    handlers: {
      "users.get": (req: { id: number }) => ({ id: req.id, name: "Ana" }),
      "clock.ticks": async function* (req: { n: number }) {
        for (let i = 0; i < req.n; i++) yield i;
      },
    },
  });
  assert.deepEqual(t.caps, { serverStream: true, bidi: false, binary: true, inProcess: true });
  assert.deepEqual(await t.unary(getUser, { id: 7 }), { id: 7, name: "Ana" });

  const out: number[] = [];
  for await (const v of t.serverStream(ticks, { n: 3 })) out.push(v);
  assert.deepEqual(out, [0, 1, 2]);
});

test("inMemoryAdapter throws for an unknown method id", async () => {
  const t = inMemoryAdapter({ handlers: {} });
  await assert.rejects(() => t.unary(getUser, { id: 1 }), /no in-memory handler/);
});

// --- interceptors ----------------------------------------------------------
test("withInterceptors composes; first listed is outermost", async () => {
  const order: string[] = [];
  const base = inMemoryAdapter({ handlers: { "users.get": () => ({ id: 1, name: "x" }) } });
  const tag =
    (label: string) =>
    (next: Transport): Transport => ({
      caps: next.caps,
      unary: (m, req, ctx) => {
        order.push(label);
        return next.unary(m, req, ctx);
      },
      serverStream: (m, req, ctx) => next.serverStream(m, req, ctx),
    });
  const t = withInterceptors(base, tag("outer"), tag("inner"));
  await t.unary(getUser, { id: 1 });
  assert.deepEqual(order, ["outer", "inner"]);
});

test("an interceptor can inject ctx (e.g. auth) seen by the adapter", async () => {
  let seenAuth: unknown;
  const base = inMemoryAdapter({
    handlers: { "users.get": (_req, ctx: CallCtx) => ((seenAuth = ctx.auth), { id: 1, name: "x" }) },
  });
  const auth =
    (token: string) =>
    (next: Transport): Transport => ({
      caps: next.caps,
      unary: (m, req, ctx = {}) => next.unary(m, req, { ...ctx, auth: token }),
      serverStream: (m, req, ctx) => next.serverStream(m, req, ctx),
    });
  await withInterceptors(base, auth("tok")).unary(getUser, { id: 1 });
  assert.equal(seenAuth, "tok");
});

// --- createRpcClient -------------------------------------------------------
test("createRpcClient.call/live delegate to the transport", async () => {
  const t = inMemoryAdapter({
    handlers: {
      "users.get": (req: { id: number }) => ({ id: req.id, name: "Z" }),
      "clock.ticks": async function* () {
        yield 9;
      },
    },
  });
  const rpc = createRpcClient(t);
  assert.deepEqual(await rpc.call(getUser, { id: 3 }), { id: 3, name: "Z" });
  const out: number[] = [];
  for await (const v of rpc.live(ticks, { n: 1 })) out.push(v);
  assert.deepEqual(out, [9]);
});

// --- REST adapter ----------------------------------------------------------
test("restAdapter maps a descriptor to an HTTP call (GET→query, headers)", async () => {
  const { fn, calls } = fakeFetch(() => ({ body: { id: 5, name: "Ana" } }));
  const t = restAdapter({ baseUrl: "/v1", fetch: fn });
  const list = method<{ page: number }, unknown>({ id: "users.get", wire: { http: { method: "GET", path: "/users", query: true } }, idempotent: true });
  const res = await t.unary(list, { page: 2 }, { auth: "tok", idempotencyKey: "k1", traceId: "tp" });
  assert.deepEqual(res, { id: 5, name: "Ana" });
  assert.equal(calls[0]!.url, "/v1/users?page=2");
  const h = calls[0]!.init.headers as Record<string, string>;
  assert.equal(h["authorization"], "Bearer tok");
  assert.equal(h["idempotency-key"], "k1");
  assert.equal(h["traceparent"], "tp");
});

test("restAdapter POSTs the request as the body; path defaults to /service/method", async () => {
  const { fn, calls } = fakeFetch(() => ({ status: 201, body: { id: 1 } }));
  const t = restAdapter({ fetch: fn });
  const create = method<{ name: string }, { id: number }>({ id: "accounts.create" });
  const res = await t.unary(create, { name: "Ana" });
  assert.deepEqual(res, { id: 1 });
  assert.equal(calls[0]!.init.method, "POST");
  assert.equal(calls[0]!.url, "/accounts/create");
  assert.deepEqual(JSON.parse(calls[0]!.init.body as string), { name: "Ana" });
});

// --- Connect adapter -------------------------------------------------------
test("connectAdapter maps to POST /{service}/{method}", async () => {
  const { fn, calls } = fakeFetch(() => ({ body: { ok: true } }));
  const t = connectAdapter({ baseUrl: "/rpc", fetch: fn });
  const m = method<{ q: string }, { ok: boolean }>({ id: "search.run", service: "catalog.Search", method: "Run" });
  const res = await t.unary(m, { q: "x" });
  assert.deepEqual(res, { ok: true });
  assert.equal(calls[0]!.url, "/rpc/catalog.Search/Run");
  assert.equal(calls[0]!.init.method, "POST");
});

// --- resource + query run OVER the port via fromMethod ---------------------
test("resource() runs over the port and reacts to a signal via fromMethod", async () => {
  const t = inMemoryAdapter({ handlers: { "users.get": (req: { id: number }) => ({ id: req.id, name: "u" + req.id }) } });
  await createRoot(async (dispose) => {
    const id = signal(1);
    const r = resource(fromMethod(t, getUser, () => ({ id: id() })));
    await tick();
    await tick();
    assert.deepEqual(r(), { id: 1, name: "u1" });
    id.set(2);
    await tick();
    await tick();
    assert.deepEqual(r(), { id: 2, name: "u2" });
    dispose();
  });
});

test("@dxjs/query runs over the port (same app, swappable adapter)", async () => {
  let hits = 0;
  const makeApp = (t: Transport) => {
    const qc = createQueryClient();
    return query(qc, ["user", 1], () => t.unary(getUser, { id: 1 }), { staleTime: Infinity });
  };
  const t = inMemoryAdapter({
    handlers: { "users.get": (req: { id: number }) => ((hits++), { id: req.id, name: "fromPort" }) },
  });
  await createRoot(async (dispose) => {
    const q = makeApp(t);
    await tick();
    await tick();
    assert.deepEqual(q.data(), { id: 1, name: "fromPort" });
    assert.equal(hits, 1);
    dispose();
  });
});
