// @dxjs/charts/config — the PURE spec→Chart.js-config mapper.
//
// Kept free of any `chart.js` runtime import (types only, erased at compile) so it
// is trivially unit-testable in node/happy-dom without a canvas. The chart
// component (./chart.ts) feeds the output of `buildConfig` straight into `new
// Chart(ctx, config)`.
//
// Palette: the validated @dxjs/ui brand ramp (same --dx-* hues the kit's ui.css
// uses). Validated with the dataviz skill's checker (light surface): lightness
// band, chroma floor, adjacent-pair CVD separation (worst ΔE 16.2 > 12) and
// contrast all PASS. Hues are assigned in FIXED ORDER, never cycled past the end
// without wrapping (a chart with >6 series should fold extras into "Other").

import type { ChartConfiguration, ChartType } from "chart.js";

/** The chart forms this kit supports. */
export type ChartKind = "bar" | "line" | "pie" | "doughnut";

/** One data series (a dataset). For pie/doughnut only the first series is used. */
export interface Series {
  label: string;
  data: number[];
  /** Optional per-series colour override (else the brand palette by index). */
  color?: string;
}

export interface ChartOptions {
  /** Stack bar/line datasets (cartesian only). */
  stacked?: boolean;
  /** Show the legend. Default: true for pie/doughnut or ≥2 series; false for a
   *  single cartesian series (the title already names it). */
  legend?: boolean;
  /** Categorical palette override (fixed order). */
  palette?: string[];
  /** Start the value axis at zero (cartesian). Default true. */
  yBeginAtZero?: boolean;
  /** Animate on first render and updates. Default true. (Set false for
   *  deterministic pixels in tests, or to avoid motion.) */
  animate?: boolean;
}

/** A design-system chart: the data's job + the data, nothing Chart.js-specific. */
export interface ChartSpec {
  kind: ChartKind;
  /** x-axis categories (bar/line) or slice names (pie/doughnut). */
  labels: string[];
  series: Series[];
  options?: ChartOptions;
}

/** The validated @dxjs brand categorical palette (fixed order). */
export const DX_PALETTE: readonly string[] = [
  "#2563eb", // accent (blue)
  "#16a34a", // positive (green)
  "#d97706", // warning (amber)
  "#dc2626", // negative (red)
  "#7c3aed", // violet
  "#0891b2", // cyan
];

const isCartesian = (kind: ChartKind): boolean => kind === "bar" || kind === "line";

/** Pick a colour for slot `i` from `palette`, wrapping if needed. */
function pick(palette: readonly string[], i: number): string {
  return palette[i % palette.length] as string;
}

/**
 * Map a {@link ChartSpec} to a Chart.js configuration object. Pure and
 * deterministic — no DOM, no `chart.js` import at runtime.
 */
export function buildConfig(spec: ChartSpec): ChartConfiguration {
  const opts = spec.options ?? {};
  const palette = opts.palette && opts.palette.length ? opts.palette : DX_PALETTE;
  const cartesian = isCartesian(spec.kind);
  const multi = spec.series.length > 1;
  const showLegend = opts.legend ?? (!cartesian || multi);

  const datasets = cartesian
    ? spec.series.map((s, i) => {
        const colour = s.color ?? pick(palette, i);
        return spec.kind === "line"
          ? {
              label: s.label,
              data: s.data,
              borderColor: colour,
              backgroundColor: colour,
              borderWidth: 2, // thin marks
              pointRadius: 3,
              pointHoverRadius: 5,
              tension: 0.25,
              fill: false,
            }
          : {
              label: s.label,
              data: s.data,
              backgroundColor: colour,
              borderColor: colour,
              borderWidth: 0,
              borderRadius: 4, // rounded data-ends
              maxBarThickness: 48,
            };
      })
    : [
        {
          label: spec.series[0]?.label ?? "",
          data: spec.series[0]?.data ?? [],
          // One colour per slice (fixed order); a 2px surface gap between fills.
          backgroundColor: (spec.series[0]?.data ?? []).map((_, i) => pick(palette, i)),
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      ];

  const config: ChartConfiguration = {
    type: spec.kind as ChartType,
    data: { labels: spec.labels, datasets: datasets as ChartConfiguration["data"]["datasets"] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: opts.animate === false ? false : undefined,
      // Chart.js default tooltips give the required hover layer.
      plugins: {
        legend: { display: showLegend, position: cartesian ? "top" : "right" },
      },
      ...(cartesian
        ? {
            scales: {
              x: { stacked: !!opts.stacked, grid: { display: false } },
              y: { stacked: !!opts.stacked, beginAtZero: opts.yBeginAtZero ?? true },
            },
          }
        : {}),
    },
  };
  return config;
}
