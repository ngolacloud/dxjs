// @dxjs/ui/controls — the base control kit: button, badge, text inputs, field
// wrapper, textarea, native select, switch, checkbox, radio group.
//
// Class-only styling (CSP-safe), safe sinks (.value/.checked bind as live
// properties; @event is addEventListener; ?attr toggles booleans). Every control
// takes an options object and reactive accessors where it helps, matching the
// rest of the kit.

import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, nextId, cx, sizeClass, type Maybe, type Size, type Tone } from "./base.ts";

// --- Button ----------------------------------------------------------------
export type ButtonVariant = "primary" | "default" | "ghost" | "subtle" | "danger";

export interface ButtonOptions {
  label?: Maybe<string>;
  onClick?: (e: MouseEvent) => void;
  variant?: ButtonVariant;
  size?: Size;
  type?: "button" | "submit" | "reset";
  disabled?: Maybe<boolean>;
  loading?: Maybe<boolean>;
  block?: boolean;
  /** Leading icon/content (a template or text). */
  icon?: Maybe<TemplateResult | string>;
  /** Accessible name when the button is icon-only. */
  ariaLabel?: string;
}

/** A button. Variants: primary · default · ghost · subtle · danger. */
export function button(o: ButtonOptions): TemplateResult {
  const cls = cx(
    "dx-btn",
    o.variant && o.variant !== "default" && `is-${o.variant}`,
    sizeClass(o.size),
    o.block && "is-block",
    !o.label && "is-icon",
  );
  return html`<button
    class=${cls}
    type=${o.type ?? "button"}
    aria-label=${o.ariaLabel ?? false}
    aria-busy=${() => (read(o.loading ?? false) ? "true" : false)}
    ?disabled=${() => read(o.disabled ?? false) || read(o.loading ?? false)}
    @click=${(e: MouseEvent) => o.onClick?.(e)}
  >${() => (read(o.loading ?? false) ? html`<span class="dx-spinner dx-btn-spin" aria-hidden="true"></span>` : o.icon ? html`<span class="dx-btn-ico" aria-hidden="true">${() => read(o.icon!)}</span>` : "")}${() => read(o.label ?? "")}</button>`;
}

/** A horizontal group of buttons with joined borders. */
export function buttonGroup(buttons: TemplateResult[]): TemplateResult {
  return html`<div class="dx-btn-group" role="group">${buttons}</div>`;
}

// --- Badge -----------------------------------------------------------------
/** A compact, squared status label (vs the rounded `pill`). */
export function badge(label: Maybe<string>, tone: Tone = "mut"): TemplateResult {
  return html`<span class=${`dx-badge is-${tone}`}>${() => read(label)}</span>`;
}

// --- Text input ------------------------------------------------------------
export interface InputOptions {
  value?: Maybe<string>;
  placeholder?: string;
  type?: "text" | "email" | "password" | "search" | "number" | "tel" | "url";
  size?: Size;
  disabled?: Maybe<boolean>;
  invalid?: Maybe<boolean>;
  onInput?: (value: string, e: Event) => void;
  onBlur?: (e: Event) => void;
  id?: string;
  ariaLabel?: string;
  ariaDescribedby?: string;
}

/** A bare, styled text input bound to a value accessor + onInput callback. */
export function input(o: InputOptions): TemplateResult {
  return html`<input
    class=${cx("dx-input", sizeClass(o.size))}
    id=${o.id ?? false}
    type=${o.type ?? "text"}
    placeholder=${o.placeholder ?? false}
    aria-label=${o.ariaLabel ?? false}
    aria-describedby=${o.ariaDescribedby ?? false}
    aria-invalid=${() => (read(o.invalid ?? false) ? "true" : false)}
    .value=${() => read(o.value ?? "")}
    ?disabled=${() => read(o.disabled ?? false)}
    @input=${(e: Event) => o.onInput?.((e.target as HTMLInputElement).value, e)}
    @blur=${(e: Event) => o.onBlur?.(e)}
  />`;
}

/** A multi-line input. */
export interface TextareaOptions extends Omit<InputOptions, "type"> {
  rows?: number;
}
export function textarea(o: TextareaOptions): TemplateResult {
  return html`<textarea
    class=${cx("dx-input dx-textarea", sizeClass(o.size))}
    id=${o.id ?? false}
    rows=${o.rows ?? 3}
    placeholder=${o.placeholder ?? false}
    aria-label=${o.ariaLabel ?? false}
    aria-invalid=${() => (read(o.invalid ?? false) ? "true" : false)}
    .value=${() => read(o.value ?? "")}
    ?disabled=${() => read(o.disabled ?? false)}
    @input=${(e: Event) => o.onInput?.((e.target as HTMLTextAreaElement).value, e)}
    @blur=${(e: Event) => o.onBlur?.(e)}
  ></textarea>`;
}

// --- Field (label + control + hint/error) ----------------------------------
export interface FieldOptions extends InputOptions {
  label: string;
  hint?: string;
  error?: Maybe<string | false | undefined>;
  required?: boolean;
  /** Supply a custom control (e.g. a select or textarea); defaults to `input`. */
  control?: (bind: { id: string; invalid: Maybe<boolean>; ariaDescribedby: string }) => TemplateResult;
}

/** A labelled field with reactive hint/error text, wired for a11y. */
export function field(o: FieldOptions): TemplateResult {
  const id = o.id ?? nextId("dx-f");
  const msgId = nextId("dx-fh");
  const invalid = (): boolean => !!read(o.error ?? false) || read(o.invalid ?? false);
  const ctl = o.control
    ? o.control({ id, invalid, ariaDescribedby: msgId })
    : input({ ...o, id, invalid, ariaDescribedby: msgId });
  return html`<div class="dx-field">
    <label class="dx-field-label" for=${id}>${o.label}${o.required ? html`<span class="dx-req" aria-hidden="true">*</span>` : ""}</label>
    ${ctl}
    ${() => {
      const err = read(o.error ?? false);
      if (err) return html`<p class="dx-field-msg is-error" id=${msgId} role="alert">${err}</p>`;
      return o.hint ? html`<p class="dx-field-msg" id=${msgId}>${o.hint}</p>` : "";
    }}
  </div>`;
}

// --- Native select ---------------------------------------------------------
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface SelectOptions {
  options: Maybe<SelectOption[]>;
  value?: Maybe<string>;
  onChange?: (value: string) => void;
  placeholder?: string;
  size?: Size;
  disabled?: Maybe<boolean>;
  id?: string;
  ariaLabel?: string;
}

/** A styled native <select> (keyboard + a11y for free). */
export function select(o: SelectOptions): TemplateResult {
  return html`<select
    class=${cx("dx-select", sizeClass(o.size))}
    id=${o.id ?? false}
    aria-label=${o.ariaLabel ?? false}
    .value=${() => read(o.value ?? "")}
    ?disabled=${() => read(o.disabled ?? false)}
    @change=${(e: Event) => o.onChange?.((e.target as HTMLSelectElement).value)}
  >${o.placeholder ? html`<option value="" disabled>${o.placeholder}</option>` : ""}${list(
    () => read(o.options),
    (x) => x.value,
    (opt) => html`<option value=${opt.value} ?disabled=${opt.disabled ?? false}>${opt.label}</option>`,
  )}</select>`;
}

// --- Switch ----------------------------------------------------------------
export interface SwitchOptions {
  checked: Maybe<boolean>;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: Maybe<boolean>;
  id?: string;
}

/** A toggle switch (role=switch; state in aria-checked, CSS reads it). */
export function switchToggle(o: SwitchOptions): TemplateResult {
  const id = o.id ?? nextId("dx-sw");
  return html`<button
    class="dx-switch"
    role="switch"
    id=${id}
    type="button"
    aria-checked=${() => (read(o.checked) ? "true" : "false")}
    ?disabled=${() => read(o.disabled ?? false)}
    @click=${() => o.onChange?.(!read(o.checked))}
  ><span class="dx-switch-track" aria-hidden="true"><span class="dx-switch-thumb"></span></span>${o.label ? html`<span class="dx-switch-label">${o.label}</span>` : ""}</button>`;
}

// --- Checkbox --------------------------------------------------------------
export interface CheckboxOptions {
  checked: Maybe<boolean>;
  onChange?: (checked: boolean) => void;
  label?: string;
  disabled?: Maybe<boolean>;
  id?: string;
}
export function checkbox(o: CheckboxOptions): TemplateResult {
  const id = o.id ?? nextId("dx-cb");
  return html`<label class="dx-check" for=${id}>
    <input
      type="checkbox"
      id=${id}
      class="dx-check-input"
      .checked=${() => read(o.checked)}
      ?disabled=${() => read(o.disabled ?? false)}
      @change=${(e: Event) => o.onChange?.((e.target as HTMLInputElement).checked)}
    />
    <span class="dx-check-box" aria-hidden="true"></span>
    ${o.label ? html`<span class="dx-check-label">${o.label}</span>` : ""}
  </label>`;
}

// --- Radio group -----------------------------------------------------------
export interface RadioOption {
  value: string;
  label: string;
  disabled?: boolean;
}
export interface RadioGroupOptions {
  options: Maybe<RadioOption[]>;
  value?: Maybe<string>;
  onChange?: (value: string) => void;
  name?: string;
  ariaLabel?: string;
}
export function radioGroup(o: RadioGroupOptions): TemplateResult {
  const name = o.name ?? nextId("dx-rg");
  return html`<div class="dx-radios" role="radiogroup" aria-label=${o.ariaLabel ?? false}>${list(
    () => read(o.options),
    (x) => x.value,
    (opt) => {
      const id = nextId("dx-r");
      return html`<label class="dx-radio" for=${id}>
        <input
          type="radio"
          id=${id}
          name=${name}
          value=${opt.value}
          class="dx-radio-input"
          .checked=${() => read(o.value ?? "") === opt.value}
          ?disabled=${opt.disabled ?? false}
          @change=${() => o.onChange?.(opt.value)}
        />
        <span class="dx-radio-dot" aria-hidden="true"></span><span class="dx-radio-label">${opt.label}</span>
      </label>`;
    },
  )}</div>`;
}
