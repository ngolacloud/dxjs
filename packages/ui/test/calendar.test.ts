import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { easterSunday, easterPlus, nthWeekday, holidaysFor, registerHolidays, holidayIndex } from "../src/holidays.ts";
import { calendar } from "../src/calendar.ts";

// --- holiday engine --------------------------------------------------------
test("easterSunday matches known Gregorian dates", () => {
  assert.equal(easterSunday(2026).toISOString().slice(0, 10), "2026-04-05");
  assert.equal(easterSunday(2025).toISOString().slice(0, 10), "2025-04-20");
  assert.equal(easterSunday(2024).toISOString().slice(0, 10), "2024-03-31");
  // Good Friday 2026 = Easter - 2
  assert.equal(easterPlus(2026, -2).toISOString().slice(0, 10), "2026-04-03");
});

test("nthWeekday computes the n-th weekday of a month (UTC)", () => {
  // 1st Monday of Sep 2026 = 2026-09-07
  assert.equal(nthWeekday(2026, 9, 1, 1).toISOString().slice(0, 10), "2026-09-07");
  // 3rd Sunday of June 2026 = 2026-06-21
  assert.equal(nthWeekday(2026, 6, 0, 3).toISOString().slice(0, 10), "2026-06-21");
});

test("Angola (pt-AO) public holidays for 2026 include the national days", () => {
  const h = holidaysFor("pt-AO", 2026);
  const dates = new Set(h.map((x) => x.date));
  assert.ok(dates.has("2026-01-01"), "Ano Novo");
  assert.ok(dates.has("2026-11-11"), "Independência");
  assert.ok(dates.has("2026-02-17"), "Carnaval (Easter-47)"); // movable
  assert.ok(dates.has("2026-04-03"), "Sexta-feira Santa");
  assert.ok(dates.has("2026-09-17"), "Herói Nacional");
  // language-prefix fallback: unknown region → "pt" not registered → "en"
  assert.ok(holidaysFor("xx-YY", 2026).some((x) => x.date === "2026-01-01"));
});

test("registerHolidays adds a custom region; holidayIndex merges years", () => {
  registerHolidays("zz-TEST", (y) => [{ date: `${y}-07-15`, name: "Test Day", type: "public" }]);
  assert.equal(holidaysFor("zz-TEST", 2030)[0]!.date, "2030-07-15");
  const idx = holidayIndex("pt-AO", [2025, 2026]);
  assert.ok(idx.has("2025-11-11") && idx.has("2026-11-11"));
});

// --- calendar component ----------------------------------------------------
test("calendar renders the selected month, localized, with holiday + event marks", () => {
  const host = body();
  const sel = signal("2026-11-11");
  render(
    calendar({
      value: () => sel(),
      locale: "pt-AO",
      holidays: true,
      events: [{ date: "2026-11-20", title: "Deploy", tone: "info" }],
      onSelect: (iso) => sel.set(iso),
    }),
    host,
  );
  // 7 weekday headers
  assert.equal(host.querySelectorAll(".dx-cal-wd").length, 7);
  // November 2026 has 30 day buttons
  assert.equal(host.querySelectorAll(".dx-cal-cell:not(.is-empty)").length, 30);
  // Independence day (11) is marked holiday + selected
  const cells = [...host.querySelectorAll(".dx-cal-cell:not(.is-empty)")];
  const d11 = cells.find((c) => c.querySelector(".dx-cal-num")!.textContent === "11")!;
  assert.ok(d11.classList.contains("is-holiday"), "11 Nov is a holiday");
  assert.ok(d11.classList.contains("is-selected"), "11 Nov is selected");
  assert.equal(d11.getAttribute("title"), "Dia da Independência Nacional");
  // event dot on the 20th
  const d20 = cells.find((c) => c.querySelector(".dx-cal-num")!.textContent === "20")!;
  assert.ok(d20.querySelector(".dx-cal-ev"), "event marker on the 20th");
  // selecting the 5th fires onSelect
  const d5 = cells.find((c) => c.querySelector(".dx-cal-num")!.textContent === "5")!;
  fire(d5, "click");
  assert.equal(sel(), "2026-11-05");
});

test("calendar next-month navigation updates the title", () => {
  const host = body();
  render(calendar({ value: () => "2026-01-15", locale: "en" }), host);
  const title = () => host.querySelector(".dx-cal-title")!.textContent;
  assert.ok(/January 2026/i.test(title()!), `got ${title()}`);
  fire(host.querySelector('[aria-label="Next month"]')!, "click");
  assert.ok(/February 2026/i.test(title()!), `got ${title()}`);
});
