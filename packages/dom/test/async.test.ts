import { body } from "./setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal, createRoot } from "@dxjs/core";
import { html, render, type TemplateResult } from "../src/index.ts";
import { asyncView, awaitBlock, asyncList, streamList, toAsyncSource } from "../src/async.ts";

/** A hand-rolled, signal-backed AsyncSource whose states the test drives directly.
 *  Its data/error/pending members are signals (callable + `.set`), so
 *  `toAsyncSource` feature-detects it as a ready AsyncSource via `.pending`. */
function fakeSource<T>(initial?: T): {
  data: ReturnType<typeof signal<T | undefined>>;
  error: ReturnType<typeof signal<unknown>>;
  pending: ReturnType<typeof signal<boolean>>;
} {
  return {
    data: signal<T | undefined>(initial),
    error: signal<unknown>(undefined),
    pending: signal<boolean>(false),
  };
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

test("asyncView: pending → data → error, fully reactive", () => {
  createRoot((dispose) => {
    const host = body();
    const src = fakeSource<string>();
    src.pending.set(true);
    render(
      asyncView(src, {
        then: (v) => html`<span class="ok">${v}</span>`,
        pending: () => html`<span class="load">loading</span>`,
        error: (e) => html`<span class="err">${String(e)}</span>`,
      }),
      host,
    );
    assert.equal(host.querySelector(".load")!.textContent, "loading");

    src.data.set("hi");
    src.pending.set(false);
    assert.equal(host.querySelector(".ok")!.textContent, "hi");
    assert.equal(host.querySelector(".load"), null);

    src.error.set("boom");
    assert.equal(host.querySelector(".err")!.textContent, "boom");
    dispose();
  });
});

test("asyncView: keepPrevious keeps data during a refetch; false flips to pending", () => {
  createRoot((dispose) => {
    const host = body();
    const src = fakeSource<string>("v1");
    render(
      asyncView(src, {
        then: (v) => html`<span class="ok">${v}</span>`,
        pending: () => html`<span class="load">loading</span>`,
        keepPrevious: true,
      }),
      host,
    );
    assert.equal(host.querySelector(".ok")!.textContent, "v1");
    src.pending.set(true); // refetch in flight, old data retained
    assert.equal(host.querySelector(".ok")!.textContent, "v1", "keepPrevious shows old data");
    assert.equal(host.querySelector(".load"), null);
    dispose();
  });

  createRoot((dispose) => {
    const host = body();
    const src = fakeSource<string>("v1");
    render(
      asyncView(src, {
        then: (v) => html`<span class="ok">${v}</span>`,
        pending: () => html`<span class="load">loading</span>`,
        keepPrevious: false,
      }),
      host,
    );
    assert.equal(host.querySelector(".ok")!.textContent, "v1");
    src.pending.set(true);
    assert.equal(host.querySelector(".load")!.textContent, "loading", "no keepPrevious → pending");
    dispose();
  });
});

test("asyncView: empty branch on [] and null", () => {
  createRoot((dispose) => {
    const host = body();
    const src = fakeSource<number[]>([]);
    render(
      asyncView(src, {
        then: (v) => html`<span class="ok">${String(v.length)}</span>`,
        empty: () => html`<span class="empty">none</span>`,
      }),
      host,
    );
    assert.equal(host.querySelector(".empty")!.textContent, "none");
    (src.data as ReturnType<typeof signal<null>>).set(null as never);
    assert.equal(host.querySelector(".empty")!.textContent, "none", "null is empty too");
    dispose();
  });
});

test("toAsyncSource: feature-detects a callable Resource/Query and derives pending", () => {
  const value = signal<number | undefined>(undefined);
  const loading = signal(true);
  const err = signal<unknown>(undefined);
  const resourceLike = Object.assign(() => value(), {
    error: () => err(),
    loading: () => loading(),
  });
  const src = toAsyncSource(resourceLike);
  assert.equal(src.pending(), true, "loading && no data → pending");
  value.set(7);
  loading.set(false);
  assert.equal(src.data(), 7);
  assert.equal(src.pending(), false);
  loading.set(true); // refetch over existing data is NOT pending
  assert.equal(src.pending(), false, "refetch with data present is not first-load pending");
});

test("awaitBlock: resolves a promise and shows data", async () => {
  await createRoot(async (dispose) => {
    const host = body();
    render(
      awaitBlock(Promise.resolve("done"), {
        then: (v) => html`<span class="ok">${v}</span>`,
        pending: () => html`<span class="load">loading</span>`,
      }),
      host,
    );
    assert.equal(host.querySelector(".load")!.textContent, "loading");
    await tick();
    assert.equal(host.querySelector(".ok")!.textContent, "done");
    dispose();
  });
});

test("awaitBlock: shows error on rejection", async () => {
  await createRoot(async (dispose) => {
    const host = body();
    render(
      awaitBlock(Promise.reject(new Error("nope")), {
        then: (v) => html`<span class="ok">${String(v)}</span>`,
        error: (e) => html`<span class="err">${(e as Error).message}</span>`,
      }),
      host,
    );
    await tick();
    assert.equal(host.querySelector(".err")!.textContent, "nope");
    dispose();
  });
});

test("awaitBlock: thunk re-runs on dep change and discards the OLD in-flight result", async () => {
  await createRoot(async (dispose) => {
    const host = body();
    const id = signal(1);
    // Deferred promises we resolve by hand, to prove the generation guard.
    const resolvers: Array<(v: string) => void> = [];
    const thunk = (): Promise<string> => {
      const n = id(); // tracked dependency
      return new Promise<string>((res) => {
        resolvers[n] = () => res("value-" + n);
      });
    };
    render(
      awaitBlock(thunk, {
        then: (v) => html`<span class="ok">${v}</span>`,
        pending: () => html`<span class="load">loading</span>`,
      }),
      host,
    );
    // First run in flight for id=1. Change the dep → supersede with id=2.
    id.set(2);
    // Resolve the OLD (superseded) promise first — must be ignored by the guard.
    resolvers[1]!();
    await tick();
    assert.equal(host.querySelector(".ok"), null, "stale result discarded");
    assert.equal(host.querySelector(".load")!.textContent, "loading");
    // Resolve the current one → wins.
    resolvers[2]!();
    await tick();
    assert.equal(host.querySelector(".ok")!.textContent, "value-2");
    dispose();
  });
});

test("asyncList: empty vs rows, reconciled by key", () => {
  createRoot((dispose) => {
    const host = body();
    const src = fakeSource<Array<{ id: number }>>([]);
    render(
      asyncList(src, {
        key: (it) => it.id,
        render: (it) => html`<li>${String(it.id)}</li>`,
        empty: () => html`<p class="empty">none</p>`,
      }),
      host,
    );
    assert.equal(host.querySelector(".empty")!.textContent, "none");
    assert.equal(host.querySelectorAll("li").length, 0);
    src.data.set([{ id: 1 }, { id: 2 }]);
    assert.equal(host.querySelectorAll("li").length, 2);
    assert.equal(host.querySelector(".empty"), null, "rows present → no empty state");
    dispose();
  });
});

test("streamList: a new array with one extra key calls render ONCE more (keyed, not full re-render)", () => {
  createRoot((dispose) => {
    const host = body();
    const feed = signal<Array<{ id: number }>>([{ id: 1 }]);
    let renders = 0;
    const renderRow = (it: { id: number }): TemplateResult => {
      renders++;
      return html`<li>${String(it.id)}</li>`;
    };
    render(
      streamList(() => feed(), {
        key: (it) => it.id,
        render: renderRow,
        empty: () => html`<p class="empty">none</p>`,
      }),
      host,
    );
    assert.equal(renders, 1);
    assert.equal(host.querySelectorAll("li").length, 1);

    // New coalesced array, one extra key → exactly one additional render call.
    feed.set([{ id: 1 }, { id: 2 }]);
    assert.equal(renders, 2, "only the new key rendered");
    assert.equal(host.querySelectorAll("li").length, 2);

    // Same keys, reordered → no new render (identity reused).
    feed.set([{ id: 2 }, { id: 1 }]);
    assert.equal(renders, 2, "reorder touches no render()");
    assert.equal(host.querySelectorAll("li").length, 2);

    // Drain to empty → empty state shows, still no new render.
    feed.set([]);
    assert.equal(renders, 2);
    assert.equal(host.querySelector(".empty")!.textContent, "none");
    dispose();
  });
});
