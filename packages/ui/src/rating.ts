// @dxjs/ui/rating — a star rating as pure SVG. Each star is an SVG <path>; filled
// vs empty is a reactive CLASS that reads the current value (no inline style, no
// canvas), so it is CSP-safe and redraws when the value signal changes. Omit
// `onChange` for a read-only display; supply it for an interactive radiogroup
// (mouse + Left/Right keyboard, optional half-steps).

import { html, type TemplateResult } from "@dxjs/dom";
import { read, nextId, cx, sizeClass, type Maybe, type Size } from "./base.ts";

export interface StarRatingOptions {
  value: Maybe<number>;
  max?: number;
  /** Omit ⇒ read-only (rendered as spans, not interactive). */
  onChange?: (v: number) => void;
  size?: Size;
  /** Allow half-star values (click left half, or ½-step keys). Default false. */
  allowHalf?: boolean;
  ariaLabel?: string;
}

// A canonical 5-point star inside a 24×24 box, as an SVG path `d` attribute.
const STAR = "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z";

/** The fill state of star `i` (1-based) for a value `v`. */
function fillState(v: number, i: number): "full" | "half" | "empty" {
  if (v >= i) return "full";
  if (v >= i - 0.5) return "half";
  return "empty";
}

/** A star rating. Read-only unless `onChange` is given. */
export function starRating(o: StarRatingOptions): TemplateResult {
  const max = o.max ?? 5;
  const half = o.allowHalf ?? false;
  const step = half ? 0.5 : 1;
  const interactive = typeof o.onChange === "function";
  const stars = Array.from({ length: max }, (_, i) => i + 1);

  const set = (v: number): void => {
    const clamped = Math.max(0, Math.min(max, v));
    o.onChange?.(clamped);
  };

  const starClass = (i: number) => () => cx("dx-star", `is-${fillState(read(o.value), i)}`);

  if (!interactive) {
    const label = o.ariaLabel ?? `${read(o.value)} of ${max} stars`;
    return html`<span
      class=${cx("dx-rating is-readonly", sizeClass(o.size))}
      role="img"
      aria-label=${label}
    >${stars.map(
      (i) => html`<span class=${starClass(i)} aria-hidden="true"><svg class="dx-star-svg" viewBox="0 0 24 24"><path d=${STAR}></path></svg></span>`,
    )}</span>`;
  }

  const onKey = (e: KeyboardEvent): void => {
    const cur = read(o.value);
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      set(cur + step);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      set(cur - step);
    }
  };

  const name = nextId("dx-rate");
  return html`<span
    class=${cx("dx-rating", sizeClass(o.size))}
    role="radiogroup"
    aria-label=${o.ariaLabel ?? false}
    @keydown=${onKey}
  >${stars.map(
    (i) => html`<button
      class=${starClass(i)}
      type="button"
      role="radio"
      name=${name}
      aria-label=${`${i} ${i === 1 ? "star" : "stars"}`}
      aria-checked=${() => (read(o.value) >= i ? "true" : "false")}
      tabindex=${() => (Math.ceil(read(o.value) || 1) === i ? "0" : "-1")}
      @click=${(e: MouseEvent) => {
        const el = e.currentTarget as HTMLElement;
        const rect = el.getBoundingClientRect();
        const leftHalf = half && rect.width > 0 && e.clientX - rect.left < rect.width / 2;
        set(leftHalf ? i - 0.5 : i);
      }}
    ><svg class="dx-star-svg" viewBox="0 0 24 24" aria-hidden="true"><path d=${STAR}></path></svg></button>`,
  )}</span>`;
}
