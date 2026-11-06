// Unit tests for @dxjs/charts. The PURE config mapper (buildConfig) is exercised
// fully here; the actual Chart.js rendering needs a real canvas 2D context (absent
// in happy-dom) and is proven in the browser under a strict CSP (e2e/csp/chart.*).
import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { render } from "@dxjs/dom";
import { buildConfig, DX_PALETTE, type ChartSpec } from "../src/config.ts";
import { chart } from "../src/chart.ts";

test("buildConfig maps a multi-series bar to Chart.js config", () => {
  const spec: ChartSpec = {
    kind: "bar",
    labels: ["Jan", "Feb", "Mar"],
    series: [
      { label: "A", data: [1, 2, 3] },
      { label: "B", data: [4, 5, 6] },
    ],
  };
  const cfg = buildConfig(spec);
  assert.equal(cfg.type, "bar");
  assert.deepEqual(cfg.data.labels, ["Jan", "Feb", "Mar"]);
  assert.equal(cfg.data.datasets.length, 2);
  // Fixed-order palette by series index.
  assert.equal((cfg.data.datasets[0] as { backgroundColor: string }).backgroundColor, DX_PALETTE[0]);
  assert.equal((cfg.data.datasets[1] as { backgroundColor: string }).backgroundColor, DX_PALETTE[1]);
  // Rounded data-ends (dataviz mark spec).
  assert.equal((cfg.data.datasets[0] as { borderRadius: number }).borderRadius, 4);
  // ≥2 series → legend on; cartesian → scales present.
  assert.equal((cfg.options as { plugins: { legend: { display: boolean } } }).plugins.legend.display, true);
  assert.ok((cfg.options as { scales?: unknown }).scales, "cartesian charts carry scales");
});

test("buildConfig: a single cartesian series hides the legend by default", () => {
  const cfg = buildConfig({ kind: "line", labels: ["a", "b"], series: [{ label: "x", data: [1, 2] }] });
  assert.equal((cfg.options as { plugins: { legend: { display: boolean } } }).plugins.legend.display, false);
  // Line marks: 2px stroke, no fill.
  assert.equal((cfg.data.datasets[0] as { borderWidth: number }).borderWidth, 2);
  assert.equal((cfg.data.datasets[0] as { fill: boolean }).fill, false);
});

test("buildConfig: doughnut uses one dataset, one colour per slice, white gaps", () => {
  const cfg = buildConfig({
    kind: "doughnut",
    labels: ["Active", "Trial", "Churned"],
    series: [{ label: "Status", data: [10, 5, 2] }],
  });
  assert.equal(cfg.type, "doughnut");
  assert.equal(cfg.data.datasets.length, 1);
  const ds = cfg.data.datasets[0] as { backgroundColor: string[]; borderColor: string; borderWidth: number };
  assert.deepEqual(ds.backgroundColor, [DX_PALETTE[0], DX_PALETTE[1], DX_PALETTE[2]]);
  assert.equal(ds.borderColor, "#ffffff"); // 2px surface gap between fills
  assert.equal(ds.borderWidth, 2);
  // Pie/doughnut have no cartesian scales; legend on by default.
  assert.equal((cfg.options as { scales?: unknown }).scales, undefined);
  assert.equal((cfg.options as { plugins: { legend: { display: boolean } } }).plugins.legend.display, true);
});

test("buildConfig: stacked toggles scale stacking; palette override respected", () => {
  const cfg = buildConfig({
    kind: "bar",
    labels: ["a"],
    series: [{ label: "A", data: [1] }, { label: "B", data: [2] }],
    options: { stacked: true, palette: ["#111111", "#222222"] },
  });
  const scales = (cfg.options as { scales: { x: { stacked: boolean }; y: { stacked: boolean } } }).scales;
  assert.equal(scales.x.stacked, true);
  assert.equal(scales.y.stacked, true);
  assert.equal((cfg.data.datasets[0] as { backgroundColor: string }).backgroundColor, "#111111");
});

test("chart() renders a <canvas> view (no Chart.js init outside a mount context)", () => {
  // Rendered via render() (not mount()): onMount runs eagerly BEFORE the node is in
  // the DOM, finds no canvas, and skips Chart.js init — so this is safe in happy-dom
  // (no 2D context) and still produces the canvas element in the output.
  const host = body();
  render(chart({ kind: "bar", labels: ["a"], series: [{ label: "A", data: [1] }] }), host);
  const canvas = host.querySelector("canvas.dx-chart");
  assert.ok(canvas, "a <canvas class=dx-chart> is rendered");
  assert.ok((canvas as Element).getAttribute("data-dxc"), "carries a stable per-chart marker");
});
