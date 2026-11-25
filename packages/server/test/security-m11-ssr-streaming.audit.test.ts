// AUDIT PoC — M11: SSR streaming resilience (A04).
//   Before the fix, the streaming SSR path had no timeout, no concurrency bound
//   and no cancellation on Suspense boundaries: a boundary whose `load()` never
//   resolves hangs the response forever, and a boundary that rejects propagates
//   out of the generator — erroring the stream and TRUNCATING the document already
//   emitted. These tests assert the SAFE behaviour (red pre-fix):
//     1. a never-resolving boundary is cut by a configurable `timeout` → fallback;
//     2. a rejecting/timed-out boundary degrades to its fallback and does NOT
//        truncate the rest of the document;
//     3. the out-of-order path bounds in-flight loads by `concurrency`.
// Run with --test-force-exit: a never-resolving `load()` is deliberately abandoned.
import { test } from "node:test";
import assert from "node:assert/strict";
import { html } from "@dxjs/dom";
import {
  renderToStringAsync,
  renderToStream,
  renderToChunksOOO,
  suspense,
} from "../src/index.ts";

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 1));
const never = (): Promise<never> => new Promise<never>(() => {});

async function readChunks(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    out += dec.decode(value);
  }
  return out;
}

test("M11: a never-resolving Suspense is cut by `timeout` → fallback, not a hang", async () => {
  const view = html`<div>${suspense(html`<em>loading…</em>`, never)}</div>`;
  // Would hang forever without a timeout; the test harness itself would time out.
  const out = await renderToStringAsync(view, { timeout: 20 });
  assert.equal(out, "<div><em>loading…</em></div>", "timed-out boundary shows its fallback");
});

test("M11: a rejecting Suspense degrades to its fallback and does NOT truncate", async () => {
  const bad = suspense(html`<em>fallback</em>`, async () => {
    await tick();
    throw new Error("boom");
  });
  const view = html`<main><h1>before</h1>${bad}<footer>after</footer></main>`;
  // Pre-fix: the reject propagates out of the generator → the whole promise
  // rejects and nothing (or only a truncated prefix) is produced.
  const out = await renderToStringAsync(view);
  assert.ok(out.includes("<h1>before</h1>"), "content before the boundary survives");
  assert.ok(out.includes("<em>fallback</em>"), "the boundary degrades to its fallback");
  assert.ok(out.includes("<footer>after</footer>"), "content AFTER the boundary is NOT truncated");
});

test("M11: renderToStream times a boundary out without erroring the stream", async () => {
  const view = html`<main><h1>shell</h1>${suspense(html`<em>fb</em>`, never)}<footer>end</footer></main>`;
  // readChunks would reject if the controller errored (pre-fix path on reject);
  // here the stream must complete cleanly with the fallback inlined.
  const out = await readChunks(renderToStream(view, { timeout: 20 }));
  assert.ok(out.includes("<h1>shell</h1>") && out.includes("<em>fb</em>") && out.includes("<footer>end</footer>"),
    `stream completed with fallback, no truncation — got: ${out}`);
});

test("M11: out-of-order path bounds in-flight loads by `concurrency`", async () => {
  let live = 0;
  let maxLive = 0;
  const slot = (n: number) =>
    suspense(html`<em>fb${n}</em>`, async () => {
      live++;
      maxLive = Math.max(maxLive, live);
      await tick();
      live--;
      return html`<p>r${n}</p>`;
    });
  const view = html`<div>${slot(1)}${slot(2)}${slot(3)}${slot(4)}${slot(5)}</div>`;

  let shell = "";
  const resolved: string[] = [];
  for await (const chunk of renderToChunksOOO(view, { concurrency: 2 })) {
    if (chunk.startsWith("<div")) shell = chunk;
    else resolved.push(chunk);
  }
  assert.ok(maxLive <= 2, `at most 2 boundaries in flight — observed ${maxLive}`);
  assert.equal(resolved.length, 5, "every boundary still resolved and streamed");
  assert.ok(shell.includes(`data-dxs="1"`), "shell carries the placeholder slots");
});

test("M11: out-of-order path cuts a never-resolving boundary by `timeout`", async () => {
  const view = html`<div>${suspense(html`<em>fb</em>`, never)}<span>${suspense("…", async () => html`<b>ok</b>`)}</span></div>`;
  let out = "";
  for await (const chunk of renderToChunksOOO(view, { timeout: 20 })) out += chunk;
  // The stuck boundary keeps its fallback slot; the resolvable one streams in.
  assert.ok(out.includes("<em>fb</em>"), "stuck boundary keeps its fallback slot");
  assert.ok(out.includes("<b>ok</b>"), "the resolvable boundary still streams");
});
