import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot, signal } from "@dxjs/core";
import {
  method, embeddedAdapter, liveSignal,
  type Transport, type CallCtx,
} from "../src/index.ts";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
const wait = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const getUser = method<{ id: number }, { id: number }>({ id: "users.get", idempotent: true });
const feed = method<{ n: number }, number>({ id: "feed.watch", kind: "serverStream" });

// --- embedded adapter ------------------------------------------------------
test("embeddedAdapter delegates unary + serverStream to the host invoke", async () => {
  const calls: string[] = [];
  const t = embeddedAdapter({
    invoke: (m, req) => {
      calls.push(m.id);
      if (m.id === "feed.watch") {
        const n = (req as { n: number }).n;
        return (async function* () {
          for (let i = 0; i < n; i++) yield i;
        })();
      }
      return { id: (req as { id: number }).id };
    },
  });
  assert.equal(t.caps.inProcess, true);
  assert.deepEqual(await t.unary(getUser, { id: 4 }), { id: 4 });
  const out: number[] = [];
  for await (const v of t.serverStream(feed, { n: 3 })) out.push(v);
  assert.deepEqual(out, [0, 1, 2]);
  assert.deepEqual(calls, ["users.get", "feed.watch"]);
});

// --- liveSignal over a NATIVE server stream --------------------------------
test("liveSignal consumes a native serverStream (value tracks the latest push)", async () => {
  const t = embeddedAdapter({
    invoke: () =>
      (async function* () {
        yield 10;
        await tick();
        yield 20;
        await tick();
        yield 30;
      })(),
  });
  await createRoot(async (dispose) => {
    const v = liveSignal<{ n: number }, number>(t, feed, { n: 0 });
    await tick();
    await tick();
    await tick();
    await tick();
    assert.equal(v(), 30, "signal holds the last streamed value");
    assert.equal(v.error(), undefined);
    dispose();
  });
});

// --- liveSignal POLL fallback (transport without a native stream) ----------
test("liveSignal falls back to polling when caps.serverStream is false", async () => {
  let n = 0;
  const pollOnly: Transport = {
    caps: { serverStream: false, bidi: false, binary: false, inProcess: false },
    unary: async () => ++n,
    serverStream: () => {
      throw new Error("no stream");
    },
  };
  await createRoot(async (dispose) => {
    const v = liveSignal<{ id: number }, number>(pollOnly, getUser, { id: 1 }, { pollMs: 5 });
    await wait(30);
    assert.ok((v() ?? 0) >= 2, `polled more than once (got ${v()})`);
    const seen = v()!;
    v.stop();
    await wait(20);
    assert.equal(v(), seen, "stop() halts polling");
    dispose();
  });
});

// --- liveSignal re-subscribes when a reactive req changes ------------------
test("liveSignal re-subscribes when a reactive req dependency changes", async () => {
  const seenReqs: number[] = [];
  const t = embeddedAdapter({
    invoke: (_m, req) => {
      const id = (req as { id: number }).id;
      seenReqs.push(id);
      return (async function* () {
        yield id * 100;
      })();
    },
  });
  await createRoot(async (dispose) => {
    const id = signal(1);
    const v = liveSignal<{ id: number }, number>(t, feed, () => ({ id: id() }));
    await tick();
    await tick();
    assert.equal(v(), 100);
    id.set(2);
    await tick();
    await tick();
    assert.equal(v(), 200, "re-subscribed with the new req");
    assert.deepEqual(seenReqs, [1, 2]);
    dispose();
  });
});

// --- ctx flows to the embedded handler -------------------------------------
test("CallCtx (meta) reaches the embedded handler", async () => {
  let gotMeta: Record<string, string> | undefined;
  const t = embeddedAdapter({
    invoke: (_m, _req, ctx: CallCtx) => {
      gotMeta = ctx.meta;
      return { id: 1 };
    },
  });
  await t.unary(getUser, { id: 1 }, { meta: { tenant: "acme" } });
  assert.deepEqual(gotMeta, { tenant: "acme" });
});
