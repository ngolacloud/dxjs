import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { component, mount, onMount } from "../src/index.ts";

test("mount renders a function component with props", () => {
  const host = body();
  const Hello = component<{ name: string }>((p) => html`<h1>hi ${p.name}</h1>`);
  mount(Hello, host, { name: "Ana" });
  assert.equal(host.querySelector("h1")!.textContent, "hi Ana");
});

test("reactive props via signals update the DOM", () => {
  const host = body();
  const n = signal(0);
  const Counter = component(() =>
    html`<button @click=${() => n.update((x) => x + 1)}>n=${() => n()}</button>`,
  );
  mount(Counter, host, {});
  const btn = host.querySelector("button")!;
  assert.equal(btn.textContent, "n=0");
  fire(btn, "click");
  assert.equal(btn.textContent, "n=1");
});

test("onMount runs after mount and its cleanup runs on dispose", () => {
  const host = body();
  const log: string[] = [];
  const C = component(() => {
    onMount(() => {
      log.push("mounted");
      return () => log.push("unmounted");
    });
    return html`<div>x</div>`;
  });
  const dispose = mount(C, host, {});
  assert.deepEqual(log, ["mounted"]);
  dispose();
  assert.deepEqual(log, ["mounted", "unmounted"]);
  assert.equal(host.querySelector("div"), null);
});

test("dispose stops reactivity", () => {
  const host = body();
  const n = signal(0);
  const C = component(() => html`<span>${() => n()}</span>`);
  const dispose = mount(C, host, {});
  const span = host.querySelector("span")!;
  n.set(1);
  assert.equal(span.textContent, "1");
  dispose();
  n.set(2); // disposed → no effect, no throw
  assert.equal(span.isConnected, false);
});
