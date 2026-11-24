import { test } from "node:test";
import assert from "node:assert/strict";
import { html } from "@dxjs/dom";
import {
  renderToString,
  renderToStringAsync,
  renderToStream,
  suspense,
  errorBoundary,
} from "../src/index.ts";

async function readChunks(stream: ReadableStream<Uint8Array>): Promise<string[]> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  const chunks: string[] = [];
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    chunks.push(dec.decode(value));
  }
  return chunks;
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 1));

test("renderToStream flushes the shell BEFORE a pending suspense resolves", async () => {
  const slow = suspense("…", async () => {
    await tick();
    return html`<p id="slow">loaded</p>`;
  });
  const view = html`<main><h1>Shell</h1>${slow}<footer>end</footer></main>`;

  const chunks = await readChunks(renderToStream(view));
  // The shell (up to the suspense) is a chunk that does NOT yet contain the async content.
  assert.ok(chunks[0]!.includes("<h1>Shell</h1>"), "first chunk carries the shell");
  assert.ok(!chunks[0]!.includes("loaded"), "first chunk precedes the resolved content");
  // The resolved content arrives in a later chunk, before the trailing shell.
  const joined = chunks.join("");
  assert.ok(joined.includes(`<p id="slow">loaded</p>`), "async content streamed in");
  assert.ok(joined.indexOf("Shell") < joined.indexOf("loaded"), "document order preserved");
  assert.ok(joined.indexOf("loaded") < joined.indexOf("end"), "then the trailing shell");
  assert.ok(chunks.length >= 2, "streamed in multiple chunks");
});

test("renderToStringAsync returns the full HTML with resolved suspense content", async () => {
  const view = html`<div>${suspense("loading", async () => {
    await tick();
    return html`<span>ready</span>`;
  })}</div>`;
  const out = await renderToStringAsync(view);
  assert.equal(out, "<div><span>ready</span></div>");
});

test("sync renderToString shows the suspense FALLBACK (cannot await)", () => {
  const view = html`<div>${suspense(html`<em>loading…</em>`, async () => html`<span>ready</span>`)}</div>`;
  assert.equal(renderToString(view), "<div><em>loading…</em></div>");
});

test("errorBoundary renders its fallback when the subtree throws (sync + stream)", async () => {
  const boom = (): string => {
    throw new Error("kaboom");
  };
  const guarded = errorBoundary(
    html`<p>${() => boom()}</p>`,
    (err) => html`<div class="err">${(err as Error).message}</div>`,
  );
  const view = html`<main>${guarded}</main>`;

  // Sync: the throw is caught, only the fallback is emitted.
  assert.equal(renderToString(view), `<main><div class="err">kaboom</div></main>`);

  // Stream: a rejecting suspense inside the boundary → fallback, atomically.
  const asyncGuarded = errorBoundary(
    suspense("…", async () => {
      await tick();
      throw new Error("async fail");
    }),
    (err) => html`<div class="err">${(err as Error).message}</div>`,
  );
  const out = await renderToStringAsync(html`<main>${asyncGuarded}</main>`);
  assert.equal(out, `<main><div class="err">async fail</div></main>`);
});

test("errorBoundary emits nothing of a partially-rendered failing child", async () => {
  // The child writes some output, then throws — the boundary must NOT leak it.
  const failing = html`<span>before</span>${() => {
    throw new Error("x");
  }}<span>after</span>`;
  const out = await renderToStringAsync(
    html`<div>${errorBoundary(failing, () => html`<b>fallback</b>`)}</div>`,
  );
  assert.equal(out, "<div><b>fallback</b></div>", "no partial 'before' leaked");
});
