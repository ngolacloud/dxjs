// AUDIT PoC — M1/M2 on the server side.
//   M1: SSR writes an un-prefixed on* attribute inline into the HTML.
//   M2: hydration applies a `.prop` (including innerHTML) as a LIVE property — and,
//       unlike the live renderer, the attribute name here comes from `planParts`
//       (the template string, case preserved), so `.innerHTML` really does run.
//       This also diverges from the escaped SSR output (the SSR↔hydration mismatch).
// Payloads avoid `src=`/`<img>` so happy-dom does not open a resource-loading handle.
// Asserts the SAFE behaviour; fails pre-fix.
import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { html } from "@dxjs/dom";
import { renderToString, hydrate } from "../src/index.ts";

test("M1: SSR does not emit an on* inline handler", () => {
  const out = renderToString(html`<div onclick=${"globalThis.__m1ssr = 1"}>x</div>`);
  assert.ok(!/onclick/i.test(out), `SSR must not emit an onclick handler — got: ${out}`);
});

test("M2: hydration does not apply a dangerous .prop (innerHTML)", () => {
  const evil = "<section data-xss>boom</section>";
  const view = html`<div .innerHTML=${evil}>safe</div>`;
  const host = body();
  host.innerHTML = renderToString(view, { hydratable: true });
  hydrate(view, host);
  const div = host.querySelector("div")!;
  assert.equal(div.querySelector("[data-xss]"), null, "hydration must not inject HTML via .innerHTML");
});
