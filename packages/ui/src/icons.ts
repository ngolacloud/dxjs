// @dxjs/ui/icons — a native stroke-icon set (24×24, currentColor, like Feather/
// Lucide). Each glyph is a TemplateResult of <path>/<circle> primitives with
// LITERAL `d`/coords — never data, never innerHTML — so the set is CSP-safe. Size
// and colour come from the `width`/`height` attributes and `currentColor`; style
// the colour with a normal CSS `color` on an ancestor.

import { html, type TemplateResult } from "@dxjs/dom";
import { cx } from "./base.ts";

export type IconName =
  | "home" | "monitor" | "activity" | "bar-chart" | "radar" | "topology"
  | "terminal" | "shield" | "users" | "box" | "key" | "file-text" | "lock"
  | "bell" | "book" | "moon" | "sun" | "panel-left" | "search" | "download"
  | "upload" | "chevron-right" | "chevron-down" | "check" | "x" | "plus"
  | "trash" | "sliders" | "grip" | "calendar" | "clock" | "folder"
  | "alert" | "info" | "refresh" | "filter" | "more" | "tasks";

// Inner geometry per glyph. Coordinates are static literals (no interpolation of
// data), so html`` emits fixed markup that the no-eval gate accepts.
const DRAW: Record<IconName, () => TemplateResult> = {
  "home": () => html`<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />`,
  "monitor": () => html`<rect x="2" y="3" width="20" height="14" rx="2" /><path d="M8 21h8M12 17v4" />`,
  "activity": () => html`<path d="M22 12h-4l-3 9L9 3l-3 9H2" />`,
  "bar-chart": () => html`<path d="M12 20V10M18 20V4M6 20v-4" />`,
  "radar": () => html`<circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.4" />`,
  "topology": () => html`<circle cx="18" cy="5" r="2.6" /><circle cx="6" cy="12" r="2.6" /><circle cx="18" cy="19" r="2.6" /><path d="m8.4 10.8 7.2-4.1M8.4 13.2l7.2 4.1" />`,
  "terminal": () => html`<path d="m4 17 6-6-6-6M12 19h8" />`,
  "shield": () => html`<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />`,
  "users": () => html`<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />`,
  "box": () => html`<path d="M21 8v8a2 2 0 0 1-1 1.73l-7 4a2 2 0 0 1-2 0l-7-4A2 2 0 0 1 3 16V8a2 2 0 0 1 1-1.73l7-4a2 2 0 0 1 2 0l7 4A2 2 0 0 1 21 8z" /><path d="m3.3 7 8.7 5 8.7-5M12 22V12" />`,
  "key": () => html`<circle cx="7.5" cy="15.5" r="4.5" /><path d="m10.7 12.3 9.3-9.3M17 5l3 3M15 7l2 2" />`,
  "file-text": () => html`<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />`,
  "lock": () => html`<rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />`,
  "bell": () => html`<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />`,
  "book": () => html`<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />`,
  "moon": () => html`<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z" />`,
  "sun": () => html`<circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />`,
  "panel-left": () => html`<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18" />`,
  "search": () => html`<circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />`,
  "download": () => html`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />`,
  "upload": () => html`<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />`,
  "chevron-right": () => html`<path d="m9 18 6-6-6-6" />`,
  "chevron-down": () => html`<path d="m6 9 6 6 6-6" />`,
  "check": () => html`<path d="M20 6 9 17l-5-5" />`,
  "x": () => html`<path d="M18 6 6 18M6 6l12 12" />`,
  "plus": () => html`<path d="M12 5v14M5 12h14" />`,
  "trash": () => html`<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />`,
  "sliders": () => html`<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6" />`,
  "grip": () => html`<circle cx="9" cy="6" r="1" /><circle cx="9" cy="12" r="1" /><circle cx="9" cy="18" r="1" /><circle cx="15" cy="6" r="1" /><circle cx="15" cy="12" r="1" /><circle cx="15" cy="18" r="1" />`,
  "calendar": () => html`<rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />`,
  "clock": () => html`<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />`,
  "folder": () => html`<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.7-.9L9.6 3.9A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />`,
  "alert": () => html`<path d="m21.7 18-8-14a2 2 0 0 0-3.4 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.7-3zM12 9v4M12 17h.01" />`,
  "info": () => html`<circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" />`,
  "refresh": () => html`<path d="M21 3v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 21v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />`,
  "filter": () => html`<path d="M22 3H2l8 9.5V19l4 2v-8.5z" />`,
  "more": () => html`<circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />`,
  "tasks": () => html`<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" /><rect x="8" y="2" width="8" height="4" rx="1" /><path d="m9 13 2 2 4-4" />`,
};

export interface IconOptions {
  /** Pixel size for width+height (default 20). */
  size?: number;
  class?: string;
  /** Accessible name. Omit for a decorative icon (aria-hidden). */
  title?: string;
}

/** Render a named icon. Decorative by default (aria-hidden); pass `title` to give
 *  it an accessible name. Colour is `currentColor` — set `color` on an ancestor. */
export function icon(name: IconName, o: IconOptions = {}): TemplateResult {
  const s = o.size ?? 20;
  return html`<svg
    class=${cx("dx-icon", o.class)}
    width=${s}
    height=${s}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.75"
    stroke-linecap="round"
    stroke-linejoin="round"
    role=${o.title ? "img" : false}
    aria-label=${o.title ?? false}
    aria-hidden=${o.title ? false : "true"}
  >${DRAW[name]()}</svg>`;
}

/** The list of available icon names (e.g. for a gallery/picker). */
export const iconNames = Object.keys(DRAW) as IconName[];
