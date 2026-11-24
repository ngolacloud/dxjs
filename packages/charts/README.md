# @dxjs/charts

CSP-safe chart components for dxjs — a thin, **signal-reactive** wrapper over
[Chart.js](https://www.chartjs.org/) v4 (bar / line / pie / doughnut) rendered to
a `<canvas>`.

Chart.js uses no `eval`/`new Function` and draws to canvas pixels (no inline
styles for the plot), so this kit runs under the same strict CSP as the rest of
dxjs (`script-src 'self'; style-src 'self'`). Proven in Chrome with **zero CSP
violations** (`e2e/csp/chart.test.mjs`).

> Unlike the core packages, `@dxjs/charts` carries a runtime dependency (Chart.js,
> ~66 KB gzip bundled) and is therefore **exempt from the core size budgets** — a
> deliberate trade for a mature charting engine. Ship it as a separate chunk.

## Usage

```ts
import { chart } from "@dxjs/charts";
import "@dxjs/charts/charts.css"; // or link it same-origin

// Inside a component / mount() context:
chart({
  kind: "doughnut",
  labels: ["Active", "Trial", "Past due", "Canceled"],
  series: [{ label: "Status", data: [62, 18, 7, 13] }],
});

// Reactive: pass an accessor; the chart updates when a signal changes.
chart(() => ({ kind: "bar", labels: months(), series: [{ label: "MRR", data: mrr() }] }));
```

For `render()`-only or vanilla (no component) use, mount imperatively:

```ts
import { mountChart } from "@dxjs/charts";
const dispose = mountChart(canvasEl, specOrAccessor); // returns a disposer
```

- `chart(spec, { class? })` — a `TemplateResult` for **component context** (uses
  `onMount` to bind its `<canvas>` once it is in the DOM).
- `mountChart(canvas, spec)` — imperative; self-contained reactive root; returns a
  disposer that calls `chart.destroy()`.
- `buildConfig(spec)` — the pure spec → Chart.js config mapper (unit-tested).

The palette is the validated `@dxjs/ui` brand ramp. Link `charts.css` same-origin
for the responsive `<canvas>` sizing (the kit only toggles classes — no inline
styles).
