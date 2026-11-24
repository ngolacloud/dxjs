import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { html } from "@dxjs/dom";
import { renderToStreamOOO, suspense, swapStreamSlots, installStreamClient } from "../src/index.ts";

const tick = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

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

test("renderToStreamOOO flushes the shell with placeholders, then boundaries in completion order", async () => {
  // Boundary A (slot 1) is slow; B (slot 2) is fast → B must stream FIRST, out of
  // document order.
  const A = suspense("fa", async () => {
    await tick(30);
    return html`<p id="a">A</p>`;
  });
  const B = suspense("fb", async () => {
    await tick(1);
    return html`<p id="b">B</p>`;
  });
  const view = html`<main><h1>S</h1>${A}<hr />${B}<footer>e</footer></main>`;

  const chunks = await readChunks(renderToStreamOOO(view));

  // 1) Shell chunk: both slots, in DOCUMENT order, showing fallbacks, no content yet.
  const shell = chunks[0]!;
  assert.ok(shell.includes(`<dxs-slot data-dxs="1">fa</dxs-slot>`), "slot 1 with fallback");
  assert.ok(shell.includes(`<dxs-slot data-dxs="2">fb</dxs-slot>`), "slot 2 with fallback");
  assert.ok(shell.indexOf(`data-dxs="1"`) < shell.indexOf(`data-dxs="2"`), "slots in document order");
  assert.ok(!shell.includes(`id="a"`) && !shell.includes(`id="b"`), "no resolved content in the shell");

  // 2) Then templates arrive in COMPLETION order: B (id 2) before A (id 1).
  const after = chunks.slice(1).join("");
  assert.ok(
    after.indexOf(`data-dxs-content="2"`) < after.indexOf(`data-dxs-content="1"`),
    "the boundary that resolved first streams first (out of document order)",
  );
  const all = chunks.join("");
  assert.ok(all.includes(`<template data-dxs-content="2"><p id="b">B</p></template>`));
  assert.ok(all.includes(`<template data-dxs-content="1"><p id="a">A</p></template>`));
});

test("renderToStreamOOO streams nested boundaries that appear inside a resolved one", async () => {
  const inner = suspense("inner-fb", async () => html`<span id="inner">deep</span>`);
  const outer = suspense("outer-fb", async () => html`<section>${inner}</section>`);
  const chunks = await readChunks(renderToStreamOOO(html`<main>${outer}</main>`));
  const all = chunks.join("");
  // Outer resolves → its template carries a NEW nested slot; the nested boundary
  // then streams its own content template.
  assert.ok(all.includes(`<dxs-slot data-dxs="1">outer-fb</dxs-slot>`), "outer placeholder in the shell");
  assert.match(all, /data-dxs-content="1".*<dxs-slot data-dxs="2">inner-fb<\/dxs-slot>/s, "outer resolves with a nested slot");
  assert.ok(all.includes(`<template data-dxs-content="2"><span id="inner">deep</span></template>`), "nested content streamed");
});

test("stream client swaps a streamed template's content into its slot", () => {
  const doc = (globalThis as { document: Document }).document;
  const host = body();

  const slot = doc.createElement("dxs-slot");
  slot.setAttribute("data-dxs", "1");
  slot.textContent = "fallback";
  host.appendChild(slot);

  const tpl = doc.createElement("template") as HTMLTemplateElement;
  tpl.setAttribute("data-dxs-content", "1");
  const p = doc.createElement("p");
  p.id = "real";
  p.textContent = "resolved";
  tpl.content.appendChild(p);
  host.appendChild(tpl);

  const swapped = swapStreamSlots(host);
  assert.equal(swapped, 1, "one slot filled");
  assert.equal(host.querySelector(`dxs-slot[data-dxs="1"]`)!.textContent, "resolved", "fallback replaced by content");
  assert.equal(host.querySelector(`template[data-dxs-content="1"]`), null, "template removed after swap");
});

test("installStreamClient performs the initial swap and returns a disposer", () => {
  const doc = (globalThis as { document: Document }).document;
  const host = body();
  const slot = doc.createElement("dxs-slot");
  slot.setAttribute("data-dxs", "7");
  slot.textContent = "fb";
  host.appendChild(slot);
  const tpl = doc.createElement("template") as HTMLTemplateElement;
  tpl.setAttribute("data-dxs-content", "7");
  const b = doc.createElement("b");
  b.textContent = "ready";
  tpl.content.appendChild(b);
  host.appendChild(tpl);

  // install swaps everything already present (then watches for more).
  const stop = installStreamClient(host);
  assert.equal(host.querySelector(`dxs-slot[data-dxs="7"]`)!.textContent, "ready", "initial pass swapped the template");
  assert.equal(typeof stop, "function", "returns a disposer");
  stop();
});
