// @dxjs/ui/numinputs — numeric entry controls: a styled range `slider` and a
// stepper `numberInput`. Class-only, reactive, CSP-safe — no inline styles and no
// handlers. The slider's fill and the tick positions are driven by CSS custom
// properties set through a `ref` effect (never a `style=""` attribute), so the
// look lives entirely in the stylesheet under `style-src 'self'`.

import { effect, onCleanup } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, sizeClass, type Maybe, type Size } from "./base.ts";
import { icon } from "./icons.ts";

// --- Slider ----------------------------------------------------------------
export interface SliderOptions {
  value: Maybe<number>;
  min?: number;
  max?: number;
  step?: number;
  /** Fires on every drag tick. */
  onInput?: (value: number) => void;
  /** Fires when the value is committed (pointer/key release). */
  onChange?: (value: number) => void;
  /** Values to render as labelled ticks beneath the track. */
  marks?: number[];
  disabled?: Maybe<boolean>;
  ariaLabel?: string;
  size?: Size;
}

/** A styled range input. The filled portion up to `value` is drawn by the CSS
 *  from the `--dx-slider-pct` custom property, which a reactive `ref` effect keeps
 *  in sync — no inline style. Optional `marks` render a labelled ticks row. */
export function slider(o: SliderOptions): TemplateResult {
  const min = o.min ?? 0;
  const max = o.max ?? 100;
  const span = max - min || 1;
  const pct = (v: number): number => Math.min(100, Math.max(0, ((v - min) / span) * 100));
  const current = (): number => {
    const v = read(o.value);
    return typeof v === "number" ? v : min;
  };

  // Keep the fill percentage in sync with the value; torn down with the owner.
  const setFill = (el: Element): void => {
    const style = (el as HTMLElement).style;
    onCleanup(
      effect(() => {
        style.setProperty("--dx-slider-pct", `${pct(current())}%`);
      }),
    );
  };

  const tick = (m: number): TemplateResult => {
    const setPos = (el: Element): void =>
      (el as HTMLElement).style.setProperty("--dx-tick-pct", `${pct(m)}%`);
    return html`<span class="dx-sld-tick" ref=${setPos}><span class="dx-sld-tick-mark"></span><span class="dx-sld-tick-label">${m}</span></span>`;
  };

  return html`<div class=${cx("dx-sld", sizeClass(o.size))} ref=${setFill}>
    <input
      class="dx-sld-input"
      type="range"
      min=${min}
      max=${max}
      step=${o.step ?? 1}
      aria-label=${o.ariaLabel ?? false}
      .value=${() => String(current())}
      ?disabled=${() => read(o.disabled ?? false)}
      @input=${(e: Event) => o.onInput?.(Number((e.target as HTMLInputElement).value))}
      @change=${(e: Event) => o.onChange?.(Number((e.target as HTMLInputElement).value))}
    />
    ${o.marks && o.marks.length > 0
      ? html`<div class="dx-sld-ticks" aria-hidden="true">${list(
          () => o.marks ?? [],
          (m) => m,
          (m) => tick(m),
        )}</div>`
      : ""}
  </div>`;
}

// --- Number input (stepper) ------------------------------------------------
export interface NumberInputOptions {
  value: Maybe<number>;
  min?: number;
  max?: number;
  /** Amount each button adds/subtracts (default 1). */
  step?: number;
  onChange?: (value: number) => void;
  disabled?: Maybe<boolean>;
  size?: Size;
  ariaLabel?: string;
}

/** A number field flanked by − and + buttons that step and clamp to [min, max].
 *  Each button disables at its bound; typing a value clamps it on commit. */
export function numberInput(o: NumberInputOptions): TemplateResult {
  const step = o.step ?? 1;
  const current = (): number => {
    const v = read(o.value);
    return typeof v === "number" ? v : (o.min ?? 0);
  };
  const clamp = (v: number): number => {
    let r = v;
    if (o.min != null) r = Math.max(o.min, r);
    if (o.max != null) r = Math.min(o.max, r);
    return r;
  };
  const atMin = (): boolean => o.min != null && current() <= o.min;
  const atMax = (): boolean => o.max != null && current() >= o.max;

  const nudge = (delta: number): void => {
    if (read(o.disabled ?? false)) return;
    const next = clamp(current() + delta);
    if (next !== current()) o.onChange?.(next);
  };
  const onFieldChange = (e: Event): void => {
    const raw = (e.target as HTMLInputElement).value;
    if (raw === "") return;
    const n = Number(raw);
    if (Number.isNaN(n)) return;
    o.onChange?.(clamp(n));
  };

  return html`<div class=${cx("dx-num", sizeClass(o.size))} role="group" aria-label=${o.ariaLabel ?? false}>
    <button
      class="dx-num-btn dx-num-dec"
      type="button"
      aria-label="Decrease"
      ?disabled=${() => read(o.disabled ?? false) || atMin()}
      @click=${() => nudge(-step)}
    >−</button>
    <input
      class="dx-num-input"
      type="number"
      inputmode="numeric"
      min=${o.min ?? false}
      max=${o.max ?? false}
      step=${step}
      aria-label=${o.ariaLabel ?? false}
      .value=${() => String(current())}
      ?disabled=${() => read(o.disabled ?? false)}
      @change=${onFieldChange}
    />
    <button
      class="dx-num-btn dx-num-inc"
      type="button"
      aria-label="Increase"
      ?disabled=${() => read(o.disabled ?? false) || atMax()}
      @click=${() => nudge(step)}
    >${icon("plus", { size: 16 })}</button>
  </div>`;
}
