// @dxjs/ui/disclosure — progressive-disclosure & progress structures: an
// accordion, a step indicator (wizard) and a vertical timeline. Class-only,
// reactive, CSP-safe. The accordion keeps its own open-state; the stepper is
// driven by a reactive `active`; the timeline is static content.

import { signal } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, nextId, cx, type Maybe, type Tone } from "./base.ts";

// --- Accordion -------------------------------------------------------------
export interface AccordionItem {
  id: string;
  title: string;
  body: Maybe<TemplateResult | string>;
  disabled?: boolean;
}
export interface AccordionOptions {
  items: Maybe<AccordionItem[]>;
  /** Allow several panels open at once (default false — single-open). */
  multiple?: boolean;
  /** Ids open on first render. */
  defaultOpen?: string[];
  onToggle?: (openIds: string[]) => void;
}

/** A set of collapsible sections. Each header is a button wired with
 *  aria-expanded / aria-controls to its region. Self-contained open-state;
 *  `onToggle` reports the open ids after every change. */
export function accordion(o: AccordionOptions): TemplateResult {
  const openIds = signal<Set<string>>(new Set(o.defaultOpen ?? []));
  const isOpen = (id: string): boolean => openIds().has(id);
  const toggle = (it: AccordionItem): void => {
    if (it.disabled) return;
    const next = new Set(openIds());
    if (next.has(it.id)) next.delete(it.id);
    else {
      if (!o.multiple) next.clear();
      next.add(it.id);
    }
    openIds.set(next);
    o.onToggle?.([...next]);
  };

  const section = (it: AccordionItem): TemplateResult => {
    const headId = nextId("dx-acc-h");
    const panelId = nextId("dx-acc-p");
    return html`<div class=${() => cx("dx-acc-item", isOpen(it.id) && "is-open")}>
      <h3 class="dx-acc-head">
        <button
          class="dx-acc-trigger"
          id=${headId}
          type="button"
          aria-expanded=${() => (isOpen(it.id) ? "true" : "false")}
          aria-controls=${panelId}
          ?disabled=${it.disabled ?? false}
          @click=${() => toggle(it)}
        ><span class="dx-acc-title">${it.title}</span><span class="dx-acc-chev" aria-hidden="true">▾</span></button>
      </h3>
      <div class="dx-acc-panel" id=${panelId} role="region" aria-labelledby=${headId} ?hidden=${() => !isOpen(it.id)}>
        <div class="dx-acc-body">${() => read(it.body)}</div>
      </div>
    </div>`;
  };

  return html`<div class="dx-acc">${list(() => read(o.items), (it) => it.id, section)}</div>`;
}

// --- Stepper ---------------------------------------------------------------
export interface Step {
  id: string;
  label: string;
  description?: string;
}
export interface StepperOptions {
  steps: Maybe<Step[]>;
  /** Active step: an id or a 0-based index. */
  active: Maybe<string | number>;
  /** Called when a (reachable) step is clicked. Omit to make steps non-interactive. */
  onStep?: (id: string, index: number) => void;
  orientation?: "horizontal" | "vertical";
}

/** A numbered step indicator (wizard). Steps before the active one are "done",
 *  the active one is "current", the rest "upcoming" (aria-current on current). */
export function stepper(o: StepperOptions): TemplateResult {
  const activeIndex = (): number => {
    const a = read(o.active);
    const steps = read(o.steps);
    if (typeof a === "number") return a;
    const i = steps.findIndex((s) => s.id === a);
    return i < 0 ? 0 : i;
  };

  const node = (s: Step, i: number): TemplateResult => {
    const state = (): "done" | "current" | "todo" => {
      const ai = activeIndex();
      return i < ai ? "done" : i === ai ? "current" : "todo";
    };
    const clickable = !!o.onStep;
    return html`<li
      class=${() => cx("dx-step", `is-${state()}`, clickable && "is-clickable")}
      aria-current=${() => (state() === "current" ? "step" : false)}
    >
      <button
        class="dx-step-btn"
        type="button"
        ?disabled=${!clickable}
        @click=${() => o.onStep?.(s.id, i)}
      >
        <span class="dx-step-marker" aria-hidden="true">${() => (state() === "done" ? "✓" : String(i + 1))}</span>
        <span class="dx-step-text">
          <span class="dx-step-label">${s.label}</span>
          ${s.description ? html`<span class="dx-step-desc">${s.description}</span>` : ""}
        </span>
      </button>
    </li>`;
  };

  return html`<ol class=${cx("dx-stepper", `is-${o.orientation ?? "horizontal"}`)}>${list(
    () => read(o.steps),
    (s) => s.id,
    node,
  )}</ol>`;
}

// --- Timeline --------------------------------------------------------------
export interface TimelineItem {
  title: string;
  /** A timestamp or short meta line. */
  time?: string;
  body?: Maybe<TemplateResult | string>;
  tone?: Tone;
  icon?: TemplateResult | string;
}

/** A vertical timeline of events. Each entry has a dot (tone-coloured) on a rail,
 *  a title, an optional time and body. Pure content — no state. */
export function timeline(items: Maybe<TimelineItem[]>): TemplateResult {
  const entry = (it: TimelineItem): TemplateResult =>
    html`<li class=${cx("dx-tl-item", `is-${it.tone ?? "mut"}`)}>
      <span class="dx-tl-dot" aria-hidden="true">${it.icon ?? ""}</span>
      <div class="dx-tl-content">
        <div class="dx-tl-head">
          <span class="dx-tl-title">${it.title}</span>
          ${it.time ? html`<span class="dx-tl-time">${it.time}</span>` : ""}
        </div>
        ${it.body ? html`<div class="dx-tl-body">${() => read(it.body!)}</div>` : ""}
      </div>
    </li>`;
  return html`<ul class="dx-tl" role="list">${list(() => read(items), (_it, i) => String(i), entry)}</ul>`;
}
