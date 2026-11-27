import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { planner, eventGeom } from "../src/planner.ts";

test("eventGeom: percentages of the visible hour span", () => {
  // 10-hour span (08:00..18:00); 1h == 10%.
  const g = eventGeom(8, 18, "09:00", "10:30");
  assert.equal(g.top, 10);
  assert.equal(g.height, 15);

  // flush to startHour → top 0.
  assert.equal(eventGeom(8, 18, "08:00", "09:00").top, 0);
});

test("planner: renders an event block in its day column, CSS vars via ref", () => {
  const host = body();
  let picked = "";
  render(
    planner({
      startHour: 8,
      endHour: 18,
      onSelect: (id) => (picked = id),
      events: [
        { id: "e1", day: 1, start: "09:00", end: "10:30", title: "Standup", tone: "info" },
        { id: "e2", day: 3, start: "13:00", end: "14:00", title: "Review" },
      ],
    }),
    host,
  );
  const blocks = host.querySelectorAll(".dx-plan-ev");
  assert.equal(blocks.length, 2, "one block per event");

  // e1 lives inside the day=1 column.
  const col1 = host.querySelector('.dx-plan-col[data-day="1"]')!;
  const e1 = col1.querySelector(".dx-plan-ev")! as unknown as HTMLElement;
  assert.ok(e1, "event block in its day column");
  assert.equal(e1.style.getPropertyValue("--dx-ev-top"), "10%");
  assert.equal(e1.style.getPropertyValue("--dx-ev-height"), "15%");

  // click reports the id.
  fire(e1 as unknown as Element, "click");
  assert.equal(picked, "e1");

  // 7 day columns + hour gutter.
  assert.equal(host.querySelectorAll(".dx-plan-col").length, 7);
  assert.equal(host.querySelectorAll(".dx-plan-hour").length, 11); // 8..18 inclusive
});

test("planner: weekStart=1 puts Monday first", () => {
  const host = body();
  render(planner({ weekStart: 1, events: () => signal<[]>([])() }), host);
  const heads = [...host.querySelectorAll(".dx-plan-col-head")].map((h) => h.textContent);
  assert.equal(heads[0], "Mon");
  assert.equal(heads[6], "Sun");
});

test("planner: today column highlight + now line with dates", () => {
  const host = body();
  render(
    planner({
      startHour: 8,
      endHour: 18,
      todayDay: 3,
      now: "12:00",
      dayDates: ["10", "11", "12", "13", "14", "15", "16"],
      events: [],
    }),
    host,
  );
  // the day=3 header and column are marked today
  assert.ok(host.querySelector('.dx-plan-col[data-day="3"]')!.classList.contains("is-today"));
  const todayHead = [...host.querySelectorAll(".dx-plan-col-head")].find((hd) => hd.classList.contains("is-today"))!;
  assert.ok(todayHead, "a column header is marked today");
  assert.equal(todayHead.querySelector(".dx-plan-col-date")!.textContent, "13");
  // now 12:00 over 08..18 → (4/10)*100 = 40%, only in the today column
  const now = host.querySelector('.dx-plan-col[data-day="3"] .dx-plan-now')! as unknown as HTMLElement;
  assert.ok(now, "now line in today column");
  assert.equal(now.style.getPropertyValue("--dx-now-top"), "40%");
  assert.equal(host.querySelectorAll(".dx-plan-now").length, 1, "now line only in today column");
});
