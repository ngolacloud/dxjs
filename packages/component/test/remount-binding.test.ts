// Regression: a top-level reactive child binding in a component must keep working
// after the component's nodes are moved from the template fragment into the host
// (which mount()/render() does). Before the fix, bindChild captured the fragment as
// its parent and re-inserts threw "insertBefore … not a child of this node".
import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal, effect } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { component, mount, onMount } from "../src/index.ts";

test("top-level conditional binding reacts after mount() moves nodes into the host", () => {
  const host = body();
  const Page = component(() => {
    const open = signal(false);
    // The ${...} is a DIRECT child of the template root (no wrapping element).
    return html`<button id="t" @click=${() => open.update((x) => !x)}>toggle</button>
      ${() => (open() ? html`<div id="panel">PANEL</div>` : "")}`;
  });
  mount(Page, host, {});
  assert.equal(host.querySelector("#panel"), null);
  fire(host.querySelector("#t")!, "click");
  assert.ok(host.querySelector("#panel"), "panel shows after toggle");
  fire(host.querySelector("#t")!, "click");
  assert.equal(host.querySelector("#panel"), null, "panel hides again");
});

test("page re-mounted via an effect keeps its top-level bindings reactive", () => {
  const host = body();
  const active = signal("a");
  const Page = component(() => {
    const open = signal(false);
    return html`<button id="t" @click=${() => open.update((x) => !x)}>t</button>
      ${() => (open() ? html`<span id="p">P</span>` : "")}`;
  });
  const Shell = component(() => {
    onMount(() => {
      const slot = host.querySelector("#slot")!;
      let dispose = (): void => {};
      const stop = effect(() => {
        active();
        dispose();
        dispose = mount(Page, slot, {});
      });
      return () => {
        stop();
        dispose();
      };
    });
    return html`<div id="slot"></div>`;
  });
  mount(Shell, host, {});
  fire(host.querySelector("#t")!, "click");
  assert.ok(host.querySelector("#p"), "the re-mounted page's binding reacted");
});
