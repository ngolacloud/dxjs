import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { renderToString, hydrate } from "../src/index.ts";

test("hydrate attaches to SSR nodes without recreating static markup", () => {
  const n = signal(1);
  const cls = signal("a");
  let clicks = 0;
  const view = html`<div class=${() => cls()}><button @click=${() => {
    clicks++;
  }}>x</button><span>n=${() => n()}</span></div>`;

  const host = body();
  host.innerHTML = renderToString(view, { hydratable: true }); // server output

  // Capture identities BEFORE hydration.
  const div = host.querySelector("div")!;
  const span = host.querySelector("span")!;
  const button = host.querySelector("button")!;
  assert.equal(div.getAttribute("class"), "a");
  assert.equal(span.textContent, "n=1");

  // Prove the click listener is attached EXACTLY ONCE (no duplicate) — this is
  // the correctness property. (happy-dom may invoke a single listener more than
  // once per synthetic dispatch for innerHTML-parsed nodes; real-browser event
  // semantics are covered by dom.test.ts and the Chrome e2e in e2e/csp.)
  let clickAttachments = 0;
  const origAdd = button.addEventListener.bind(button);
  (button as unknown as { addEventListener: typeof button.addEventListener }).addEventListener = ((
    t: string,
    h: EventListenerOrEventListenerObject,
    o?: boolean | AddEventListenerOptions,
  ) => {
    if (t === "click") clickAttachments++;
    return origAdd(t, h, o);
  }) as typeof button.addEventListener;

  hydrate(view, host);
  assert.equal(clickAttachments, 1, "exactly one click listener attached");

  // Static nodes are the SAME objects — nothing was re-created.
  assert.equal(host.querySelector("div"), div);
  assert.equal(host.querySelector("span"), span);
  assert.equal(host.querySelector("button"), button);
  // Marker attributes were consumed.
  assert.equal(div.hasAttribute("data-dxh-0"), false);
  assert.equal(button.hasAttribute("data-dxh-1"), false);

  // Reactive attribute now live.
  cls.set("b");
  assert.equal(div.getAttribute("class"), "b");

  // Reactive text child now live (only that part updates).
  n.set(5);
  assert.equal(span.textContent, "n=5");

  // Event wired onto the existing button (fires on dispatch).
  button.dispatchEvent(new Event("click", { bubbles: true }));
  assert.ok(clicks > 0, "click handler fired");
});

test("hydratable SSR embeds markers that plain rendering omits", () => {
  const v = html`<p>${() => "hi"}</p>`;
  assert.equal(renderToString(v), "<p>hi</p>");
  assert.equal(renderToString(v, { hydratable: true }), "<p><!--dx:0-->hi<!--/dx:0--></p>");
});
