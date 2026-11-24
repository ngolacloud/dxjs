import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot } from "@dxjs/core";
import { createQueryClient, query, keyOf } from "../src/index.ts";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

test("keyOf serialises arrays deterministically (stable object key order)", () => {
  assert.equal(keyOf("todos"), "todos");
  assert.equal(keyOf(["todos", 1]), '["todos",1]');
  assert.equal(keyOf([{ b: 2, a: 1 }]), keyOf([{ a: 1, b: 2 }]));
});

test("query fetches once and exposes data; isLoading flips", async () => {
  const client = createQueryClient();
  let calls = 0;
  await createRoot(async () => {
    const q = query(client, ["n"], async () => (calls++, 42));
    assert.equal(q.isLoading(), true, "loading before first result");
    assert.equal(q.data(), undefined);
    await tick();
    assert.equal(q.data(), 42);
    assert.equal(q.isLoading(), false);
    assert.equal(calls, 1);
  });
});

test("dedupe: concurrent queries for one key share a single fetch", async () => {
  const client = createQueryClient();
  let calls = 0;
  await createRoot(async () => {
    const a = query(client, ["same"], async () => (calls++, "x"));
    const b = query(client, ["same"], async () => (calls++, "x"));
    await tick();
    assert.equal(a.data(), "x");
    assert.equal(b.data(), "x");
    assert.equal(calls, 1, "the fetcher ran once for two observers");
  });
});

test("cache: a fresh entry (staleTime Infinity) is not refetched", async () => {
  const client = createQueryClient();
  let calls = 0;
  await createRoot(async () => {
    const q1 = query(client, ["k"], async () => (calls++, "v"), { staleTime: Infinity });
    await tick();
    assert.equal(q1.data(), "v");
    const q2 = query(client, ["k"], async () => (calls++, "v2"), { staleTime: Infinity });
    await tick();
    assert.equal(q2.data(), "v", "served from cache, not refetched");
    assert.equal(calls, 1);
  });
});

test("invalidate(prefix) refetches live observers and updates data", async () => {
  const client = createQueryClient();
  let value = "first";
  await createRoot(async () => {
    const q = query(client, ["todos", 1], async () => value, { staleTime: Infinity });
    await tick();
    assert.equal(q.data(), "first");
    value = "second";
    await client.invalidate(["todos"]); // prefix match
    assert.equal(q.data(), "second", "invalidation triggered a refetch for the live observer");
  });
});

test("refetch() forces a new fetch", async () => {
  const client = createQueryClient();
  let calls = 0;
  await createRoot(async () => {
    const q = query(client, ["r"], async () => (calls++, calls), { staleTime: Infinity });
    await tick();
    assert.equal(q.data(), 1);
    await q.refetch();
    assert.equal(q.data(), 2);
    assert.equal(calls, 2);
  });
});

test("setData / getData: optimistic cache writes", async () => {
  const client = createQueryClient();
  await createRoot(async () => {
    const q = query(client, ["o"], async () => "server", { staleTime: Infinity });
    await tick();
    assert.equal(client.getData(["o"]), "server");
    client.setData(["o"], "optimistic");
    assert.equal(q.data(), "optimistic");
    assert.equal(client.getData(["o"]), "optimistic");
  });
});

test("error path: a rejected fetcher surfaces on .error()", async () => {
  const client = createQueryClient();
  await createRoot(async () => {
    const q = query(client, ["bad"], async () => {
      throw new Error("nope");
    });
    await tick();
    assert.match(String((q.error() as Error).message), /nope/);
    assert.equal(q.data(), undefined);
  });
});
