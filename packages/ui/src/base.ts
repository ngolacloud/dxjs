// @dxjs/ui/base — internal helpers shared by the component modules. Not part of
// the public surface shape, but re-exported types (Tone, Size, Maybe) are.

import type { Accessor } from "@dxjs/core";

/** Status tone used across pills, alerts, badges, buttons. */
export type Tone = "pos" | "neg" | "warn" | "mut" | "info";

/** Bootstrap-style size tiers. */
export type SizeTier = "xs" | "sm" | "md" | "lg" | "xl" | "xxl";
/** A size: a named tier OR the numeric alias 1–6 (1≡xs … 3≡md … 6≡xxl). */
export type Size = SizeTier | 1 | 2 | 3 | 4 | 5 | 6;

const TIERS: SizeTier[] = ["xs", "sm", "md", "lg", "xl", "xxl"];

/** Normalise a Size (tier or 1–6) to its tier. Defaults to "md". */
export const resolveSize = (s?: Size): SizeTier =>
  typeof s === "number" ? (TIERS[Math.min(6, Math.max(1, s)) - 1] ?? "md") : (s ?? "md");

/** The density class for a control, e.g. `dx-sz-lg`. Returns "" for md (the
 *  default), so the base rule applies. Every control reads `--dx-ctl-*` vars that
 *  these classes set — one size system, no per-component size CSS. */
export const sizeClass = (s?: Size): string => {
  const t = resolveSize(s);
  return t === "md" ? "" : `dx-sz-${t}`;
};

/** A value that may be static or a reactive accessor. */
export type Maybe<T> = T | Accessor<T>;

/** Read a Maybe<T>: call it if it is a function, else return it. */
export const read = <T>(v: Maybe<T>): T => (typeof v === "function" ? (v as () => T)() : v);

// Monotonic ids for ARIA wiring (aria-labelledby, aria-controls, label `for`).
// Module-scoped, never on window; client-only.
let uid = 0;
export const nextId = (prefix: string): string => `${prefix}-${++uid}`;

/** Join class fragments, dropping falsy ones. */
export const cx = (...parts: Array<string | false | null | undefined>): string =>
  parts.filter(Boolean).join(" ");
