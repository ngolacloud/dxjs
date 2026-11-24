// @dxjs/i18n — a tiny, CSP-safe i18n layer with a REACTIVE locale, built on
// @dxjs/core signals and the platform `Intl` API. Defaults to Angolan Portuguese
// (pt-AO) with the Kwanza (AOA) as the default currency.
//
// Translation is a dictionary lookup + `{param}` interpolation via string
// replacement — no `eval`, no `new Function`, no template compilation of data,
// so it runs under a strict CSP. `t`/`n`/`d`/`currency` read the locale signal,
// so any binding that uses them re-derives when the locale changes.

import { signal, type Accessor } from "@dxjs/core";

/** A (possibly nested) message dictionary. Leaves are strings. */
export interface Messages {
  [key: string]: string | Messages;
}

export interface I18nOptions {
  /** Initial locale (BCP-47). Defaults to "pt-AO". */
  locale?: string;
  /** Locale consulted when a key is missing in the active locale. */
  fallbackLocale?: string;
  /** Default currency for `currency()`. Defaults to "AOA" (Kwanza). */
  defaultCurrency?: string;
  /** locale → messages. */
  messages: Record<string, Messages>;
}

export interface I18n {
  /** Reactive current locale. */
  locale: Accessor<string>;
  /** Switch the active locale (re-derives every binding that read `t`/`n`/`d`). */
  setLocale(locale: string): void;
  /** Translate `key` (dot-path) with optional `{param}` interpolation. Falls back
   *  to `fallbackLocale`, then returns the key itself if still unresolved. */
  t(key: string, params?: Record<string, string | number>): string;
  /** Format a number with `Intl.NumberFormat` in the active locale. */
  n(value: number, options?: Intl.NumberFormatOptions): string;
  /** Format a date with `Intl.DateTimeFormat` in the active locale. */
  d(value: Date | number, options?: Intl.DateTimeFormatOptions): string;
  /** Format a currency amount (defaults to the configured `defaultCurrency`). */
  currency(value: number, currency?: string): string;
}

const DEFAULT_LOCALE = "pt-AO";
const DEFAULT_CURRENCY = "AOA";

function resolve(messages: Messages | undefined, key: string): string | undefined {
  let cur: string | Messages | undefined = messages;
  for (const part of key.split(".")) {
    if (cur && typeof cur === "object") cur = (cur as Messages)[part];
    else return undefined;
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(str: string, params?: Record<string, string | number>): string {
  if (!params) return str;
  // Only substitutes `{name}` placeholders with provided values — a plain string
  // replace, never code execution.
  return str.replace(/\{(\w+)\}/g, (whole, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : whole,
  );
}

/** Create a reactive i18n instance. */
export function createI18n(options: I18nOptions): I18n {
  const locale = signal(options.locale ?? DEFAULT_LOCALE);
  const fallback = options.fallbackLocale;
  const defaultCurrency = options.defaultCurrency ?? DEFAULT_CURRENCY;
  const messages = options.messages;

  // Cache Intl formatters (constructing them is relatively costly). Keyed by
  // locale + serialized options.
  const numCache = new Map<string, Intl.NumberFormat>();
  const dateCache = new Map<string, Intl.DateTimeFormat>();
  const numFmt = (loc: string, opts?: Intl.NumberFormatOptions): Intl.NumberFormat => {
    const k = loc + "|" + (opts ? JSON.stringify(opts) : "");
    let f = numCache.get(k);
    if (!f) {
      f = new Intl.NumberFormat(loc, opts);
      numCache.set(k, f);
    }
    return f;
  };
  const dateFmt = (loc: string, opts?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat => {
    const k = loc + "|" + (opts ? JSON.stringify(opts) : "");
    let f = dateCache.get(k);
    if (!f) {
      f = new Intl.DateTimeFormat(loc, opts);
      dateCache.set(k, f);
    }
    return f;
  };

  return {
    locale: () => locale(),
    setLocale(next: string): void {
      locale.set(next);
    },
    t(key: string, params?: Record<string, string | number>): string {
      const loc = locale(); // reactive dependency
      const hit = resolve(messages[loc], key) ?? (fallback ? resolve(messages[fallback], key) : undefined) ?? key;
      return interpolate(hit, params);
    },
    n(value: number, opts?: Intl.NumberFormatOptions): string {
      return numFmt(locale(), opts).format(value);
    },
    d(value: Date | number, opts?: Intl.DateTimeFormatOptions): string {
      return dateFmt(locale(), opts).format(value);
    },
    currency(value: number, currency?: string): string {
      return numFmt(locale(), { style: "currency", currency: currency ?? defaultCurrency }).format(value);
    },
  };
}
