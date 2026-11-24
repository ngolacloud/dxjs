// @dxjs/ui/holidays — a tiny, offline holiday engine for the smart calendar.
// Everything is computed in UTC (no timezone drift): fixed dates, nth-weekday
// rules and Easter-relative movable feasts via the Anonymous Gregorian computus.
// Ships Angola (pt-AO) thoroughly plus a minimal generic set, and is PLUGGABLE
// via registerHolidays() so any region can be added without a network call.

export type HolidayType = "public" | "bank" | "observance" | "special";
export interface Holiday {
  /** ISO date, YYYY-MM-DD (UTC). */
  date: string;
  name: string;
  type: HolidayType;
}
export type HolidayProvider = (year: number) => Holiday[];

const iso = (d: Date): string => d.toISOString().slice(0, 10);
const utc = (y: number, month1: number, day: number): Date => new Date(Date.UTC(y, month1 - 1, day));
const DAY = 86400000;

/** Gregorian Easter Sunday (Meeus/Jones/Butcher algorithm), as a UTC date. */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3 = March, 4 = April
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}
/** Easter Sunday shifted by `offset` days (e.g. -2 Good Friday, +1 Easter Monday). */
export const easterPlus = (year: number, offset: number): Date =>
  new Date(easterSunday(year).getTime() + offset * DAY);

/** The `n`-th `weekday` (0=Sun … 6=Sat) of `month1` (1–12), in `year` (UTC). */
export function nthWeekday(year: number, month1: number, weekday: number, n: number): Date {
  const first = utc(year, month1, 1);
  const shift = (weekday - first.getUTCDay() + 7) % 7;
  return utc(year, month1, 1 + shift + (n - 1) * 7);
}

// --- Registry --------------------------------------------------------------
const REGISTRY: Record<string, HolidayProvider> = {
  // Angola — the console's home locale (dates per the national calendar).
  "pt-AO": (y) => [
    { date: iso(utc(y, 1, 1)), name: "Ano Novo", type: "public" },
    { date: iso(utc(y, 2, 4)), name: "Dia do Início da Luta Armada", type: "public" },
    { date: iso(easterPlus(y, -47)), name: "Terça-feira de Carnaval", type: "public" },
    { date: iso(utc(y, 3, 8)), name: "Dia Internacional da Mulher", type: "public" },
    { date: iso(utc(y, 3, 23)), name: "Dia da Libertação da África Austral", type: "public" },
    { date: iso(easterPlus(y, -2)), name: "Sexta-feira Santa", type: "public" },
    { date: iso(utc(y, 4, 4)), name: "Dia da Paz e Reconciliação Nacional", type: "public" },
    { date: iso(utc(y, 5, 1)), name: "Dia do Trabalhador", type: "public" },
    { date: iso(utc(y, 9, 17)), name: "Dia do Fundador da Nação e do Herói Nacional", type: "public" },
    { date: iso(utc(y, 11, 2)), name: "Dia dos Finados", type: "public" },
    { date: iso(utc(y, 11, 11)), name: "Dia da Independência Nacional", type: "public" },
    { date: iso(utc(y, 12, 25)), name: "Dia de Natal e da Família", type: "public" },
  ],
  // Minimal generic/international fallback.
  "en": (y) => [
    { date: iso(utc(y, 1, 1)), name: "New Year's Day", type: "public" },
    { date: iso(easterPlus(y, -2)), name: "Good Friday", type: "public" },
    { date: iso(easterPlus(y, 1)), name: "Easter Monday", type: "public" },
    { date: iso(utc(y, 5, 1)), name: "Labour Day", type: "public" },
    { date: iso(utc(y, 12, 25)), name: "Christmas Day", type: "public" },
    { date: iso(utc(y, 12, 26)), name: "Boxing Day", type: "public" },
  ],
  "pt-PT": (y) => [
    { date: iso(utc(y, 1, 1)), name: "Ano Novo", type: "public" },
    { date: iso(easterPlus(y, -47)), name: "Carnaval", type: "observance" },
    { date: iso(easterPlus(y, -2)), name: "Sexta-feira Santa", type: "public" },
    { date: iso(easterSunday(y)), name: "Páscoa", type: "public" },
    { date: iso(utc(y, 4, 25)), name: "Dia da Liberdade", type: "public" },
    { date: iso(utc(y, 5, 1)), name: "Dia do Trabalhador", type: "public" },
    { date: iso(utc(y, 6, 10)), name: "Dia de Portugal", type: "public" },
    { date: iso(utc(y, 12, 25)), name: "Natal", type: "public" },
  ],
};

/** Register (or override) a region's holiday provider. */
export function registerHolidays(locale: string, provider: HolidayProvider): void {
  REGISTRY[locale] = provider;
}

/** Holidays for `locale` in `year`. Resolution: exact locale → language prefix →
 *  "en". Returns [] gracefully if nothing matches. */
export function holidaysFor(locale: string, year: number): Holiday[] {
  const lang = locale.split("-")[0]!;
  const provider = REGISTRY[locale] ?? REGISTRY[lang] ?? REGISTRY["en"];
  return provider ? provider(year) : [];
}

/** Build a fast date→Holiday index for a locale across the given year(s). */
export function holidayIndex(locale: string, years: number[]): Map<string, Holiday> {
  const m = new Map<string, Holiday>();
  for (const y of years) for (const h of holidaysFor(locale, y)) if (!m.has(h.date)) m.set(h.date, h);
  return m;
}
