import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot } from "@dxjs/core";
import { createQueryClient, query, type QueryClient, type QueryKey } from "@dxjs/query";
import { method, withInterceptors, inMemoryAdapter, embeddedAdapter, restAdapter } from "@dxjs/transport";
import { openapiClient, type OpenApiDocument } from "@dxjs/openapi";
import { toSeivaError, seivaErrors, liveInvalidation, type SeivaError, type SeivaEvent } from "../src/index.ts";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

const httpErr = (status: number, body: unknown): Error =>
  Object.assign(new Error("http"), { name: "HttpError", status, body });

// --- toSeivaError mapping --------------------------------------------------
test("toSeivaError maps HTTP statuses to kinds + extracts field errors", () => {
  const v = toSeivaError(httpErr(422, { fields: { email: "is required" }, trace_id: "tp-1" }));
  assert.equal(v.kind, "validation");
  assert.deepEqual(v.fields, { email: "is required" });
  assert.equal(v.traceId, "tp-1");
  assert.equal(v.retryable, false);

  assert.equal(toSeivaError(httpErr(403, {})).kind, "forbidden"); // scope/BOLA
  assert.equal(toSeivaError(httpErr(401, {})).kind, "unauthorized");
  assert.equal(toSeivaError(httpErr(409, {})).kind, "conflict"); // optimistic concurrency
  assert.equal(toSeivaError(httpErr(412, {})).kind, "conflict");
  assert.equal(toSeivaError(httpErr(404, {})).kind, "not-found");
  const s = toSeivaError(httpErr(503, {}));
  assert.equal(s.kind, "server");
  assert.equal(s.retryable, true);
});

test("toSeivaError reads RFC-9457 `errors` (array messages) + Connect codes + network", () => {
  const v = toSeivaError(httpErr(400, { errors: { name: ["too short", "bad"] }, detail: "invalid" }));
  assert.deepEqual(v.fields, { name: "too short" });
  assert.equal(v.message, "invalid");

  const c = toSeivaError(Object.assign(new Error("denied"), { name: "ConnectError", code: "permission_denied" }));
  assert.equal(c.kind, "forbidden");

  const g = toSeivaError(Object.assign(new Error("x"), { name: "GrpcError", code: "unavailable" }));
  assert.equal(g.kind, "server");
  assert.equal(g.retryable, true);

  const n = toSeivaError(Object.assign(new TypeError("Failed to fetch"), {}));
  assert.equal(n.kind, "network");
  assert.equal(n.retryable, true);

  assert.equal(toSeivaError(toSeivaError(httpErr(409, {}))).kind, "conflict"); // idempotent
});

// --- seivaErrors() interceptor ---------------------------------------------
test("seivaErrors() interceptor converts thrown errors at the port boundary", async () => {
  const m = method({ id: "accounts.create" });
  const base = inMemoryAdapter({
    handlers: {
      "accounts.create": () => {
        throw httpErr(422, { fields: { name: "is required" } });
      },
    },
  });
  const t = withInterceptors(base, seivaErrors());
  const e = await t.unary(m, {}).then(
    () => null,
    (err) => err as SeivaError,
  );
  assert.ok(e);
  assert.equal(e!.name, "SeivaError");
  assert.equal(e!.kind, "validation");
  assert.deepEqual(e!.fields, { name: "is required" });
});

// --- events → @dxjs/query invalidation -------------------------------------
test("liveInvalidation invalidates query keys from a server event stream", async () => {
  const events = method<unknown, SeivaEvent>({ id: "events.stream", kind: "serverStream" });
  const t = embeddedAdapter({
    invoke: () =>
      (async function* () {
        await tick();
        yield { type: "accounts.changed", resource: "accounts" } as SeivaEvent;
      })(),
  });
  await createRoot(async (dispose) => {
    const client = createQueryClient();
    let hits = 0;
    const q = query(client, ["accounts"], async () => ++hits, { staleTime: Infinity });
    await tick();
    await tick();
    assert.equal(q.data(), 1, "first fetch");

    liveInvalidation<SeivaEvent>(t, events, client, (ev) =>
      ev.resource === "accounts" ? [["accounts"]] : [],
    );
    await tick();
    await tick();
    await tick();
    assert.equal(hits, 2, "the event invalidated ['accounts'] → refetch");
    dispose();
  });
});

// --- THE PROOF: the same app over two adapters (remote + embedded) ----------
const doc: OpenApiDocument = {
  paths: {
    "/accounts": {
      post: {
        operationId: "createAccount",
        requestBody: {
          content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" } } } } },
        },
      },
    },
  },
};

// IDENTICAL app code; only the adapter differs.
async function createAccount(adapter: Parameters<typeof withInterceptors>[0]): Promise<SeivaError | null> {
  const api = openapiClient(doc, withInterceptors(adapter, seivaErrors()));
  return api.call("createAccount", {}).then(
    () => null,
    (e) => e as SeivaError,
  );
}

test("the SAME app yields identical SeivaError over restAdapter (remote) and embeddedAdapter (in-process)", async () => {
  // remote: REST 422 from a mock server
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ fields: { name: "is required" } }), {
      status: 422,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;
  const remote = await createAccount(restAdapter({ baseUrl: "/v1", fetch: fetchImpl }));

  // embedded: the host dispatcher throws the same envelope in-process
  const embedded = await createAccount(
    embeddedAdapter({
      invoke: () => {
        throw httpErr(422, { fields: { name: "is required" } });
      },
    }),
  );

  for (const e of [remote, embedded]) {
    assert.ok(e, "both rejected");
    assert.equal(e!.name, "SeivaError");
    assert.equal(e!.kind, "validation");
    assert.deepEqual(e!.fields, { name: "is required" });
  }
  assert.deepEqual(remote!.fields, embedded!.fields, "identical field errors across adapters");
});

// keep the QueryClient/QueryKey types referenced (documents the contract used above)
const _k: QueryKey = ["accounts"];
const _c: Pick<QueryClient, "invalidate"> = { invalidate: async () => {} };
void _k;
void _c;
