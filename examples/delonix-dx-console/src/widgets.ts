// Small shared widgets. The meter is drawn as an inline SVG whose fill width is a
// geometry ATTRIBUTE (not a style attribute) — so it stays CSP-clean (style-src
// 'self') while still being per-row dynamic.
import { html, type TemplateResult } from "@dxjs/dom";
import type { Tone } from "./compute.ts";

/** Tone for a usage percentage (green < 70 < amber < 90 < red). */
export function usageTone(percent: number): Tone {
  return percent < 70 ? "pos" : percent < 90 ? "warn" : "neg";
}

/** A thin usage meter. `percent === null` renders an em dash (e.g. a stopped container). */
export function meter(percent: number | null, label: string, tone: Tone = "mut"): TemplateResult {
  if (percent === null) return html`<span class="meter-na">${label}</span>`;
  const w = Math.max(0, Math.min(100, percent));
  return html`<span class="meter">
    <svg class="meter-svg" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true">
      <rect class="meter-bg" x="0" y="0" width="100" height="8"></rect>
      <rect class=${"meter-fill is-" + tone} x="0" y="0" width=${w} height="8"></rect>
    </svg>
    <span class="meter-label">${label}</span>
  </span>`;
}

/** A guessed type glyph for a container image (the console's ContainerTypeIcon is also a guess). */
export function typeGlyph(image: string): string {
  const map: Record<string, string> = {
    nginx: "🌐",
    caddy: "🌐",
    postgres: "🗄",
    redis: "⚡",
    rabbitmq: "🐇",
    node: "⬢",
    golang: "🐹",
    grafana: "📊",
  };
  return map[image] ?? "📦";
}
