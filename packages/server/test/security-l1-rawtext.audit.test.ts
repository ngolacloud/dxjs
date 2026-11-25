// AUDIT PoC — L1: the SSR scanner must treat <script>/<style> as RAW-TEXT. There,
//   HTML entities are not decoded, so escape() does not stop CSS/JS injection
//   (e.g. `<style>${"}body{display:none}"}` injects a CSS rule with no HTML-special
//   char). The fix REFUSES dynamic interpolation inside <script>/<style> (drops it),
//   while RCDATA (<title>/<textarea>) keeps normal HTML-escaping. Asserts the SAFE
//   behaviour across every SSR string path (red pre-fix: the payload appears).
import { test } from "node:test";
import assert from "node:assert/strict";
import { html } from "@dxjs/dom";
import { renderToString, renderToStringAsync, renderToChunksOOO } from "../src/index.ts";

const CSS = "}body{display:none}";
const JS = "evil()";

test("L1: dynamic <style> content is refused (dropped), not injected", () => {
  const out = renderToString(html`<style>${CSS}</style>`);
  assert.ok(!out.includes("display:none"), `CSS injection must be dropped — got: ${out}`);
  assert.equal(out, "<style></style>");
});

test("L1: dynamic <script> content is refused (dropped)", () => {
  const out = renderToString(html`<script>${JS}</script>`);
  assert.ok(!out.includes("evil()"), `JS injection must be dropped — got: ${out}`);
  assert.equal(out, "<script></script>");
});

test("L1: <style> with attributes is still detected as raw-text", () => {
  const out = renderToString(html`<style type="text/css">${CSS}</style>`);
  assert.ok(!out.includes("display:none"));
});

test("L1: RCDATA (<title>) still escapes normally (not dropped)", () => {
  const out = renderToString(html`<title>${"a<b & c"}</title>`);
  assert.equal(out, "<title>a&lt;b &amp; c</title>", "title keeps HTML-escaped content");
});

test("L1: the refusal holds on the async + out-of-order paths", async () => {
  assert.equal(await renderToStringAsync(html`<style>${CSS}</style>`), "<style></style>");
  let ooo = "";
  for await (const c of renderToChunksOOO(html`<script>${JS}</script>`)) ooo += c;
  assert.ok(!ooo.includes("evil()"), `OOO must drop raw-text injection — got: ${ooo}`);
});
