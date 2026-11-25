// AUDIT PoC — M1 (MÉDIO): an attribute whose name begins with `on` but lacks the
// `@` / camelCase form falls into the generic setAttribute sink, producing an inline
// event handler (violating the engine's own "NEVER an inline on*= attribute"). This
// asserts the SAFE behaviour (on* refused, not written); it fails pre-fix.
import { body } from "./setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { html, render } from "../src/index.ts";

test("M1: on* attribute is not written as an inline handler (html path)", () => {
  const host = body();
  render(html`<div onclick=${"globalThis.__m1 = 1"}>x</div>`, host);
  const div = host.querySelector("div")!;
  assert.equal(div.getAttribute("onclick"), null, "onclick must not be set as an inline handler");
});

test("M1: on* is refused regardless of the event name", () => {
  const host = body();
  render(html`<img src="x" onerror=${"globalThis.__m1b = 1"} />`, host);
  const img = host.querySelector("img")!;
  assert.equal(img.getAttribute("onerror"), null, "onerror must not be set inline");
});

test("M1: a legitimate @event handler still binds via addEventListener", () => {
  const host = body();
  let clicks = 0;
  render(html`<button @click=${() => clicks++}>go</button>`, host);
  const btn = host.querySelector("button")!;
  assert.equal(btn.getAttribute("onclick"), null);
  btn.dispatchEvent(new (globalThis as unknown as { Event: typeof Event }).Event("click"));
  assert.equal(clicks, 1, "@click must still work");
});
