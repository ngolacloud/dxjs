// AUDIT PoC — L9: media (`image`/`video`) and `avatar` set src/poster from input.
//   The audit flagged "no scheme validation (delegates to CSP)", but H1 made the
//   renderer sanitise URL-bearing attributes (href/src/poster/action/…) at the SINK
//   via isUrlAttr/sanitizeUrl — so `src`/`poster` ARE scheme-checked when rendered,
//   client AND SSR. This is a VERIFICATION guard for that coverage (no new code in
//   the components): a `javascript:`/hostile-`data:` URL is neutralised through them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToString } from "@dxjs/server";
import { image, video } from "../src/media.ts";
import { avatar } from "../src/nav.ts";

test("L9: avatar drops a javascript: src (covered by H1 sink sanitising)", () => {
  const out = renderToString(avatar({ src: "javascript:alert(1)", name: "x" }));
  assert.ok(!out.toLowerCase().includes("javascript:"), `javascript: src must be neutralised — got: ${out}`);
});

test("L9: image drops a hostile data: src", () => {
  const out = renderToString(image({ src: "data:text/html,<script>alert(1)</script>", alt: "x" }));
  assert.ok(!out.includes("text/html"), `hostile data: URL must be neutralised — got: ${out}`);
});

test("L9: video poster is scheme-sanitised too", () => {
  const out = renderToString(video({ src: "/clip.mp4", poster: "javascript:alert(1)" }));
  assert.ok(!out.toLowerCase().includes("javascript:"), `poster must be neutralised — got: ${out}`);
});

test("L9: ordinary URLs still pass through untouched", () => {
  const out = renderToString(avatar({ src: "https://cdn.example/a.png", name: "x" }));
  assert.ok(out.includes("https://cdn.example/a.png"), "a normal https src is preserved");
});
