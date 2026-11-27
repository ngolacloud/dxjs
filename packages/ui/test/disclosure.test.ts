import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html, render } from "@dxjs/dom";
import { accordion, stepper, timeline } from "../src/index.ts";

// --- Accordion -------------------------------------------------------------
test("accordion: single-open by default; opening one closes the other", () => {
  const host = body();
  let open: string[] = [];
  render(
    accordion({
      items: [
        { id: "a", title: "Alpha", body: "A body" },
        { id: "b", title: "Beta", body: html`<p id="bb">B body</p>` },
        { id: "c", title: "Gamma", body: "C body", disabled: true },
      ],
      defaultOpen: ["a"],
      onToggle: (ids) => (open = ids),
    }),
    host,
  );
  const triggers = [...host.querySelectorAll(".dx-acc-trigger")];
  const panels = [...host.querySelectorAll(".dx-acc-panel")];
  // a open initially
  assert.equal(triggers[0]!.getAttribute("aria-expanded"), "true");
  assert.equal(panels[0]!.hasAttribute("hidden"), false);
  assert.ok(panels[1]!.hasAttribute("hidden"));
  // each panel is wired to its header
  assert.equal(panels[0]!.getAttribute("aria-labelledby"), triggers[0]!.id);
  assert.equal(triggers[0]!.getAttribute("aria-controls"), panels[0]!.id);

  // open b → a closes (single-open)
  fire(triggers[1]!, "click");
  assert.deepEqual(open, ["b"]);
  assert.ok(panels[0]!.hasAttribute("hidden"));
  assert.equal(panels[1]!.hasAttribute("hidden"), false);

  // disabled c cannot open
  fire(triggers[2]!, "click");
  assert.deepEqual(open, ["b"]);
});

test("accordion: multiple allows several panels open at once", () => {
  const host = body();
  render(
    accordion({
      multiple: true,
      items: [
        { id: "a", title: "A", body: "a" },
        { id: "b", title: "B", body: "b" },
      ],
    }),
    host,
  );
  const triggers = [...host.querySelectorAll(".dx-acc-trigger")];
  fire(triggers[0]!, "click");
  fire(triggers[1]!, "click");
  assert.equal(host.querySelectorAll(".dx-acc-item.is-open").length, 2);
});

// --- Stepper ---------------------------------------------------------------
test("stepper: marks done/current/upcoming from a reactive active index", () => {
  const host = body();
  const active = signal(1);
  render(
    stepper({
      steps: [
        { id: "s1", label: "Account" },
        { id: "s2", label: "Profile", description: "Your details" },
        { id: "s3", label: "Done" },
      ],
      active: () => active(),
    }),
    host,
  );
  const steps = [...host.querySelectorAll(".dx-step")];
  assert.ok(steps[0]!.classList.contains("is-done"));
  assert.ok(steps[1]!.classList.contains("is-current"));
  assert.ok(steps[2]!.classList.contains("is-todo"));
  assert.equal(steps[1]!.getAttribute("aria-current"), "step");
  // done step shows a check; current shows its number
  assert.equal(host.querySelector(".dx-step.is-done .dx-step-marker")!.textContent, "✓");
  assert.equal(host.querySelector(".dx-step.is-current .dx-step-marker")!.textContent, "2");

  active.set(2);
  assert.ok(steps[1]!.classList.contains("is-done"));
  assert.ok(steps[2]!.classList.contains("is-current"));
});

test("stepper: clicking a step fires onStep when interactive; accepts an id as active", () => {
  const host = body();
  let went = "";
  render(
    stepper({
      steps: [
        { id: "s1", label: "One" },
        { id: "s2", label: "Two" },
      ],
      active: "s2",
      onStep: (id) => (went = id),
    }),
    host,
  );
  // active given as id "s2" → second step is current
  assert.ok([...host.querySelectorAll(".dx-step")][1]!.classList.contains("is-current"));
  fire(host.querySelector(".dx-step-btn")!, "click");
  assert.equal(went, "s1");
});

// --- Timeline --------------------------------------------------------------
test("timeline: renders an entry per item with title, time and tone", () => {
  const host = body();
  render(
    timeline([
      { title: "Created", time: "09:00", tone: "pos" },
      { title: "Shipped", time: "12:30", body: html`<em id="tb">tracking #42</em>` },
    ]),
    host,
  );
  assert.equal(host.querySelector(".dx-tl")!.getAttribute("role"), "list");
  const items = [...host.querySelectorAll(".dx-tl-item")];
  assert.equal(items.length, 2);
  assert.ok(items[0]!.classList.contains("is-pos"));
  assert.equal(host.querySelector(".dx-tl-title")!.textContent, "Created");
  assert.equal(host.querySelector(".dx-tl-time")!.textContent, "09:00");
  assert.equal(host.querySelector("#tb")!.textContent, "tracking #42");
});
