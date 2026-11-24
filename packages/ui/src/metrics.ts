// @dxjs/ui/metrics — rich KPI tiles. A `metric` enriches `statCard` with a tone
// arrow on the delta, an optional inline `sparkline` trend, an icon, a hint and
// an optional clickable (button) shell. `metricGrid` lays tiles out responsively.
// CSP-strict: class-only, no inline style, no eval; everything reactive via
// accessors read through `read`.

import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, sizeClass, type Maybe, type Size, type Tone } from "./base.ts";
import { sparkline } from "./sparkline.ts";

export interface MetricOptions {
  label: string;
  value: Maybe<string | number>;
  /** Change indicator, e.g. "+12%". Coloured and arrowed by `tone`. */
  delta?: Maybe<string>;
  /** Tone colours the delta and the trend; derives the arrow (pos→▲, neg→▼). */
  tone?: Tone;
  /** Trend series; when present an inline sparkline is drawn on the right. */
  trend?: Maybe<number[]>;
  /** Leading glyph: a template or a plain string. */
  icon?: TemplateResult | string;
  /** A muted sub-caption under the value. */
  hint?: string;
  /** When set, the tile is a clickable `<button>`. */
  onClick?: () => void;
  size?: Size;
}

/** The directional arrow for a tone: up for positive, down for negative. */
const arrow = (tone?: Tone): string => (tone === "pos" ? "▲" : tone === "neg" ? "▼" : "");

/** A rich KPI tile. Clickable when `onClick` is given, else a static div. */
export function metric(o: MetricOptions): TemplateResult {
  const tone = o.tone ?? "mut";
  const cls = cx("dx-metric", sizeClass(o.size), o.onClick && "is-clickable");

  const body = html`<div class="dx-metric-main">
      <div class="dx-metric-label">${o.label}</div>
      <div class="dx-metric-value">${() => read(o.value)}</div>
      ${o.delta
        ? html`<div class=${`dx-metric-delta is-${tone}`}><span class="dx-metric-arrow" aria-hidden="true">${arrow(o.tone)}</span>${() => read(o.delta!)}</div>`
        : ""}
      ${o.hint ? html`<div class="dx-metric-hint">${o.hint}</div>` : ""}
    </div>${o.trend
      ? html`<div class="dx-metric-trend">${sparkline({ data: o.trend, tone: o.tone, fill: true })}</div>`
      : ""}`;

  const inner = html`${o.icon ? html`<div class="dx-metric-icon" aria-hidden="true">${o.icon}</div>` : ""}${body}`;

  return o.onClick
    ? html`<button type="button" class=${cls} @click=${o.onClick}>${inner}</button>`
    : html`<div class=${cls}>${inner}</div>`;
}

/** A responsive grid of metric tiles, keyed by label. */
export function metricGrid(metrics: MetricOptions[]): TemplateResult {
  return html`<div class="dx-metrics">${list(metrics, (m) => m.label, metric)}</div>`;
}
