import "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { html } from "@dxjs/dom";
import { component, defineElement, type ElementProps } from "../src/index.ts";

const doc = () => (globalThis as { document: Document }).document;

test("defineElement mounts a component, maps attributes to reactive props, disposes on disconnect", () => {
  const Greeter = component<ElementProps>((props) => html`<p class="greet">Hi ${() => props.name?.() ?? "?"}</p>`);
  defineElement("dx-greeter", Greeter, { attributes: ["name"] });

  const el = doc().createElement("dx-greeter");
  el.setAttribute("name", "Ana");
  doc().body.appendChild(el); // connect → mount
  assert.equal(el.querySelector(".greet")!.textContent, "Hi Ana", "attribute flowed in as a prop");

  // Changing the attribute re-renders reactively (no remount).
  el.setAttribute("name", "Bento");
  assert.equal(el.querySelector(".greet")!.textContent, "Hi Bento", "attribute change is reactive");

  // Disconnect disposes the mount (nodes removed).
  doc().body.removeChild(el);
  assert.equal(el.querySelector(".greet"), null, "disconnect tore the component down");
});

test("defineElement works with no observed attributes (mount/unmount)", () => {
  const Plain = component<ElementProps>(() => html`<span class="plain">static</span>`);
  defineElement("dx-plain", Plain);
  const el = doc().createElement("dx-plain");
  doc().body.appendChild(el);
  assert.equal(el.querySelector(".plain")!.textContent, "static", "mounted");
  doc().body.removeChild(el);
  assert.equal(el.querySelector(".plain"), null, "unmounted");
});

test("defineElement is idempotent (re-defining the same tag is a no-op)", () => {
  const A = component<ElementProps>(() => html`<i class="a">one</i>`);
  const B = component<ElementProps>(() => html`<i class="b">two</i>`);
  defineElement("dx-once", A);
  defineElement("dx-once", B); // ignored — first definition wins
  const el = doc().createElement("dx-once");
  doc().body.appendChild(el);
  assert.ok(el.querySelector(".a"), "the first definition is kept");
  assert.equal(el.querySelector(".b"), null, "the second define was a no-op");
  doc().body.removeChild(el);
});
