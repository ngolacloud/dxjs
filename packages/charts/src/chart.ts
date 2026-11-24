// @dxjs/charts/chart — the reactive chart component + imperative mounter.
//
// Chart.js draws to a <canvas> (pixels, not DOM): no inline styles for the plot,
// no `eval`/`new Function` in Chart.js v4 core → CSP-clean under `script-src
// 'self'`. We register ONLY the controllers/elements/scales we use, so bundlers
// tree-shake the rest of Chart.js.
//
// Two layers:
//   - mountChart(canvas, spec): imperative, self-contained (its own reactive root).
//     Works anywhere — including plain `render()` and vanilla browser usage.
//   - chart(spec, opts): declarative TemplateResult for COMPONENT context (uses
//     onMount to grab its canvas once it is in the DOM). Use inside `mount()` /
//     a `component`.

import { createRoot, effect, onCleanup, type Accessor } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { onMount } from "@dxjs/component";
import {
  Chart,
  BarController,
  LineController,
  PieController,
  DoughnutController,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Title,
} from "chart.js";
import { buildConfig, type ChartSpec } from "./config.ts";

// Register the tree-shakeable subset the kit uses (idempotent — safe to call once
// at module load; Chart.js dedupes registrations).
Chart.register(
  BarController,
  LineController,
  PieController,
  DoughnutController,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Legend,
  Tooltip,
  Title,
);

/** A value that may be a static spec or a reactive accessor of one. */
export type MaybeSpec = ChartSpec | Accessor<ChartSpec>;

const readSpec = (s: MaybeSpec): ChartSpec => (typeof s === "function" ? s() : s);

/**
 * Create a Chart.js chart on `canvas` from `spec`, re-rendering reactively when a
 * signal read inside `spec` changes. Returns a disposer that destroys the chart
 * and tears down the reactive root. Self-contained — safe to call outside a
 * component (plain `render()` / vanilla browser).
 */
export function mountChart(canvas: HTMLCanvasElement, spec: MaybeSpec): () => void {
  return createRoot((dispose) => {
    let chart: Chart | null = null;
    effect(() => {
      const s = readSpec(spec);
      if (!chart) {
        chart = new Chart(canvas, buildConfig(s));
      } else {
        const next = buildConfig(s);
        // Surgical update: swap data in place, keep the instance (animated).
        chart.data = next.data;
        if (next.options) chart.options = next.options;
        chart.update();
      }
    });
    onCleanup(() => chart?.destroy());
    return dispose;
  });
}

let seq = 0;

/**
 * A chart as a dxjs view: `html\`<div class="dx-chart-wrap"><canvas/></div>\``.
 * Must be used in COMPONENT context (inside `mount()` / a `component`), so its
 * `onMount` fires once the canvas is in the DOM. For `render()`-only or vanilla
 * use, call {@link mountChart} on your own canvas.
 */
export function chart(spec: MaybeSpec, opts: { class?: string } = {}): TemplateResult {
  const id = `dxc${seq++}`;
  const cls = opts.class ? `dx-chart ${opts.class}` : "dx-chart";
  onMount(() => {
    const canvas = document.querySelector(
      `canvas[data-dxc="${id}"]`,
    ) as HTMLCanvasElement | null;
    if (!canvas) return; // not in a mount() context, or torn down already
    return mountChart(canvas, spec);
  });
  return html`<div class="dx-chart-wrap"><canvas class=${cls} data-dxc=${id}></canvas></div>`;
}
