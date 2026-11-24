import { test } from "node:test";
import assert from "node:assert/strict";
import { effect } from "@dxjs/core";
import { createI18n } from "../src/index.ts";

const messages = {
  "pt-AO": {
    greeting: "Olá, {name}!",
    nav: { home: "Início", users: "Utilizadores" },
    items: "{count} itens",
  },
  "en-US": {
    greeting: "Hello, {name}!",
    nav: { home: "Home" },
  },
};

test("t resolves pt-AO messages with interpolation", () => {
  const i18n = createI18n({ messages });
  assert.equal(i18n.locale(), "pt-AO", "defaults to pt-AO");
  assert.equal(i18n.t("greeting", { name: "Ana" }), "Olá, Ana!");
  assert.equal(i18n.t("nav.users"), "Utilizadores", "dot-path resolution");
  assert.equal(i18n.t("items", { count: 3 }), "3 itens", "numeric params stringified");
});

test("t falls back to fallbackLocale, then to the key", () => {
  const i18n = createI18n({ locale: "en-US", fallbackLocale: "pt-AO", messages });
  assert.equal(i18n.t("nav.home"), "Home", "found in active locale");
  assert.equal(i18n.t("nav.users"), "Utilizadores", "missing in en-US → fallback pt-AO");
  assert.equal(i18n.t("totally.unknown"), "totally.unknown", "unresolved → the key itself");
  // Unknown placeholder is left intact, not crashed.
  assert.equal(i18n.t("greeting", {}), "Hello, {name}!");
});

test("n/d/currency match Intl for pt-AO (default AOA → Kz)", () => {
  const i18n = createI18n({ messages });
  assert.equal(i18n.n(1234567.89), new Intl.NumberFormat("pt-AO").format(1234567.89));
  const cur = i18n.currency(1234.5);
  assert.equal(cur, new Intl.NumberFormat("pt-AO", { style: "currency", currency: "AOA" }).format(1234.5));
  assert.ok(cur.includes("Kz"), `pt-AO AOA renders the Kwanza symbol, got "${cur}"`);
  const date = new Date(Date.UTC(2026, 10, 24));
  assert.equal(
    i18n.d(date, { dateStyle: "long", timeZone: "UTC" }),
    new Intl.DateTimeFormat("pt-AO", { dateStyle: "long", timeZone: "UTC" }).format(date),
  );
});

test("switching the locale re-derives t and n inside a reactive effect", () => {
  const i18n = createI18n({ fallbackLocale: "pt-AO", messages });
  const seen: string[] = [];
  const nums: string[] = [];
  const stop = effect(() => {
    seen.push(i18n.t("greeting", { name: "Ana" }));
    nums.push(i18n.n(1000));
  });
  assert.equal(seen.at(-1), "Olá, Ana!");
  const ptNum = nums.at(-1)!;

  i18n.setLocale("en-US");
  assert.equal(seen.at(-1), "Hello, Ana!", "t re-derived on locale change");
  assert.notEqual(nums.at(-1), ptNum, "number formatting changed with the locale");
  assert.equal(nums.at(-1), new Intl.NumberFormat("en-US").format(1000));
  stop();
});
