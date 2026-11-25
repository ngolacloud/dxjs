// AUDIT PoC — M2 (MÉDIO), live-DOM side. The `.prop` sink writes any DOM property.
// On the LIVE path a data payload cannot reach `innerHTML` because the HTML parser
// lowercases attribute names, so `.innerHTML` becomes the inert expando `innerhtml`
// — the live renderer is safe here BY ACCIDENT. These tests lock that in (regression)
// and verify the hardening still refuses a dangerous property explicitly. The real
// exploitable vector is hydration (see server/test/security-m1-m2-ssr-hydrate).
import { body } from "./setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { html, render } from "../src/index.ts";

test("M2: .innerHTML via html`` does not inject HTML (parser lowercases → inert)", () => {
  const host = body();
  render(html`<div .innerHTML=${'<section data-xss></section>'}>safe</div>`, host);
  const div = host.querySelector("div")!;
  assert.equal(div.querySelector("[data-xss]"), null, ".innerHTML must not inject elements");
});

test("M2: a safe .prop (value) still binds", () => {
  const host = body();
  render(html`<input .value=${"hello"} />`, host);
  const input = host.querySelector("input") as unknown as { value: string };
  assert.equal(input.value, "hello", "safe properties must still bind");
});
