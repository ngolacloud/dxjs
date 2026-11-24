// @dxjs/charts — CSP-safe chart components for dxjs.
//
// A thin, signal-reactive wrapper over Chart.js (bar / line / pie / doughnut)
// rendered to a <canvas>. Chart.js v4 uses no `eval`/`new Function` and draws to
// canvas pixels (no inline styles for the plot), so the kit runs under the same
// strict CSP as the rest of dxjs (`script-src 'self'; style-src 'self'`). The
// stylesheet ships as ./charts.css and is linked same-origin.
//
// Unlike the core packages, @dxjs/charts carries a runtime dependency (chart.js)
// and is therefore EXEMPT from the core size budgets — a deliberate trade for a
// mature charting engine. See DESIGN.md §1 and docs/parity/react-parity.md.

export { chart, mountChart, type MaybeSpec } from "./chart.ts";
export {
  buildConfig,
  DX_PALETTE,
  type ChartSpec,
  type ChartKind,
  type ChartOptions,
  type Series,
} from "./config.ts";
