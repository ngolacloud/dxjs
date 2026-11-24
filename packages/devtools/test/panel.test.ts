import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal, computed, effect } from "@dxjs/core";
import { createDevtools, renderPanel } from "../src/index.ts";

const cells = (host: Element, row: Element): string[] => [...row.querySelectorAll("td")].map((td) => td.textContent ?? "");
const rowFor = (host: Element, name: string): Element | undefined =>
  [...host.querySelectorAll("tbody tr")].find((tr) => tr.querySelector("td:nth-child(2)")?.textContent === name);

test("devtoolsPanel renders a row per node and updates live on a write", () => {
  const dev = createDevtools();
  try {
    const n = signal(1, { name: "count" });
    const double = computed(() => n() * 2, { name: "double" });
    effect(() => double(), "watch"); // reading `double` forces the (lazy) computed to run

    const host = body();
    renderPanel(dev, host);

    assert.ok(rowFor(host, "count"), "signal row present");
    assert.ok(rowFor(host, "double"), "computed row present");
    assert.ok(rowFor(host, "watch"), "effect row present");

    // The signal's value cell reads 1, the computed 2.
    assert.equal(cells(host, rowFor(host, "count")!)[2], "1");
    assert.equal(cells(host, rowFor(host, "double")!)[2], "2");
    const watchRunsBefore = Number(cells(host, rowFor(host, "watch")!)[3]);

    // Write → the panel reflects the new values and the effect's run count.
    n.set(5);
    assert.equal(cells(host, rowFor(host, "count")!)[2], "5", "signal value updated live");
    assert.equal(cells(host, rowFor(host, "double")!)[2], "10", "computed value updated live");
    assert.ok(Number(cells(host, rowFor(host, "watch")!)[3]) > watchRunsBefore, "effect runs incremented");
  } finally {
    dev.stop();
  }
});

test("devtoolsPanel filters: hide-disposed and by kind", () => {
  const dev = createDevtools();
  try {
    signal(0, { name: "keep" });
    const stop = effect(() => {}, "temp");

    const host = body();
    renderPanel(dev, host);
    assert.equal(host.querySelectorAll("tbody tr").length, 2, "both nodes shown");

    // Dispose the effect, then tick the hide-disposed checkbox → it drops out.
    stop();
    assert.ok(rowFor(host, "temp"), "disposed row still shown by default");
    const checkbox = host.querySelector('input[type="checkbox"]') as HTMLInputElement;
    checkbox.checked = true;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    assert.equal(rowFor(host, "temp"), undefined, "disposed node hidden");
    assert.ok(rowFor(host, "keep"), "live node still shown");

    // Kind filter: click "Signals" → only the signal remains (uncheck hide first).
    checkbox.checked = false;
    checkbox.dispatchEvent(new Event("change", { bubbles: true }));
    const signalsChip = [...host.querySelectorAll(".dx-dt-chip")].find((b) => b.getAttribute("data-kind") === "signal")!;
    signalsChip.dispatchEvent(new Event("click", { bubbles: true }));
    const kinds = [...host.querySelectorAll("tbody tr td:first-child")].map((td) => td.textContent);
    assert.deepEqual(kinds, ["signal"], "only signals shown");
  } finally {
    dev.stop();
  }
});
