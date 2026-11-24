// @dxjs/ui/sparkline — a tiny inline trend chart as pure SVG. Points are an SVG
// polyline `points` ATTRIBUTE (no inline style, no canvas), so it is CSP-safe and
// reactive: pass an accessor and the line redraws when the data signal changes.
// For full charts use @dxjs/charts (Chart.js); this is for inline KPI trends.

import { html, type TemplateResult } from "@dxjs/dom";
import { read, cx, type Maybe, type Tone } from "./base.ts";

export interface SparklineOptions {
  data: Maybe<number[]>;
  width?: number;
  height?: number;
  tone?: Tone;
  /** Draw a soft area fill under the line. */
  fill?: boolean;
  /** Mark the last point. */
  dot?: boolean;
  ariaLabel?: string;
}

/** An inline sparkline (trend line). Width/height are the SVG viewBox; the line
 *  scales to fit its container via CSS. */
export function sparkline(o: SparklineOptions): TemplateResult {
  const W = o.width ?? 100;
  const H = o.height ?? 28;
  const pad = 1.5;

  const coords = (): Array<[number, number]> => {
    const d = read(o.data);
    if (d.length === 0) return [];
    const min = Math.min(...d);
    const max = Math.max(...d);
    const range = max - min || 1;
    const step = d.length > 1 ? (W - pad * 2) / (d.length - 1) : 0;
    return d.map((v, i) => [pad + i * step, H - pad - ((v - min) / range) * (H - pad * 2)]);
  };
  const line = (): string => coords().map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = (): string => {
    const c = coords();
    if (c.length === 0) return "";
    const first = c[0]!;
    const last = c[c.length - 1]!;
    return `${first[0].toFixed(1)},${H} ${line()} ${last[0].toFixed(1)},${H}`;
  };
  const lastPoint = (): [number, number] => {
    const c = coords();
    return c.length ? c[c.length - 1]! : [0, 0];
  };

  return html`<svg
    class=${cx("dx-spark", o.tone && `is-${o.tone}`)}
    viewBox=${`0 0 ${W} ${H}`}
    preserveAspectRatio="none"
    role="img"
    aria-label=${o.ariaLabel ?? false}
  >${o.fill ? html`<polyline class="dx-spark-fill" points=${() => area()}></polyline>` : ""}<polyline
      class="dx-spark-line"
      points=${() => line()}
    ></polyline>${o.dot
      ? html`<circle class="dx-spark-dot" r="2" cx=${() => lastPoint()[0].toFixed(1)} cy=${() => lastPoint()[1].toFixed(1)}></circle>`
      : ""}</svg>`;
}
