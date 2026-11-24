import "../../dom/test/setup.ts";
import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { metric, metricGrid } from "../src/metrics.ts";

test("metric: label + value, delta tone, reactive value", () => {
  const host = body();
  const v = signal<string | number>(42);
  render(metric({ label: "Revenue", value: () => v(), delta: "+8%", tone: "pos" }), host);

  assert.equal(host.querySelector(".dx-metric-label")!.textContent, "Revenue");
  assert.equal(host.querySelector(".dx-metric-value")!.textContent, "42");

  const delta = host.querySelector(".dx-metric-delta")!;
  assert.ok(delta.classList.contains("is-pos"), "delta carries tone class");
  assert.ok(delta.textContent!.includes("▲"), "positive tone yields up arrow");

  v.set(99);
  assert.equal(host.querySelector(".dx-metric-value")!.textContent, "99", "value updates reactively");
});

test("metric: negative tone arrow", () => {
  const host = body();
  render(metric({ label: "Churn", value: "3%", delta: "-2%", tone: "neg" }), host);
  const delta = host.querySelector(".dx-metric-delta")!;
  assert.ok(delta.classList.contains("is-neg"));
  assert.ok(delta.textContent!.includes("▼"), "negative tone yields down arrow");
});

test("metric: trend renders an svg.dx-spark", () => {
  const host = body();
  render(metric({ label: "Signups", value: 120, trend: [1, 4, 2, 8, 6], tone: "pos" }), host);
  assert.ok(host.querySelector("svg.dx-spark"), "sparkline present when trend given");
  assert.ok(host.querySelector(".dx-spark.is-pos"), "sparkline shares the tone");

  const noTrend = body();
  render(metric({ label: "Flat", value: 1 }), noTrend);
  assert.equal(noTrend.querySelector("svg.dx-spark"), null, "no sparkline without trend");
});

test("metric: onClick renders a clickable button and fires", () => {
  const host = body();
  let clicks = 0;
  render(metric({ label: "Open", value: 7, onClick: () => clicks++ }), host);
  const btn = host.querySelector("button.dx-metric.is-clickable")!;
  assert.ok(btn, "clickable metric is a button");
  fire(btn, "click");
  assert.equal(clicks, 1);
});

test("metricGrid: one tile per entry", () => {
  const host = body();
  render(metricGrid([
    { label: "A", value: 1 },
    { label: "B", value: 2, trend: [1, 2, 3] },
    { label: "C", value: 3, onClick: () => {} },
  ]), host);
  assert.equal(host.querySelectorAll(".dx-metrics .dx-metric").length, 3);
});
