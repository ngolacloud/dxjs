// @dxjs/ui/theme — a tiny reactive theme controller for the Cloud Shell.
//
// It flips a `data-theme` attribute on the document root; the look lives entirely
// in ui.css (token overrides under `:root[data-theme="dark"|"light"]` plus a
// `prefers-color-scheme` default). No inline styles → strict-CSP safe. "system"
// removes the attribute so the OS preference wins.

import { signal, type Accessor } from "@dxjs/core";

export type Theme = "light" | "dark" | "system";

export interface ThemeController {
  /** Reactive current theme. */
  theme: Accessor<Theme>;
  /** Set the theme (writes/removes `data-theme` on the document root). */
  setTheme(next: Theme): void;
  /** Flip between light and dark (treats "system" as the start of light→dark). */
  toggle(): void;
}

function rootEl(): Element | null {
  return (globalThis as { document?: Document }).document?.documentElement ?? null;
}

function apply(next: Theme): void {
  const el = rootEl();
  if (!el) return;
  if (next === "system") el.removeAttribute("data-theme");
  else el.setAttribute("data-theme", next);
}

/** Create a theme controller. Applies `initial` to the document root immediately. */
export function createThemeController(initial: Theme = "system"): ThemeController {
  const current = signal<Theme>(initial);
  apply(initial);
  return {
    theme: () => current(),
    setTheme(next: Theme): void {
      current.set(next);
      apply(next);
    },
    toggle(): void {
      const next: Theme = current() === "dark" ? "light" : "dark";
      current.set(next);
      apply(next);
    },
  };
}
