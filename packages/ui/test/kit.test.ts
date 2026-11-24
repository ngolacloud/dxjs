import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import {
  button, buttonGroup, badge, input, field, textarea, select, switchToggle, checkbox, radioGroup,
  alert, modal, tooltip, skeleton, spinner, progress, meter, emptyState,
  tabs, segmented, breadcrumb, navPanel, avatar, divider,
  searchableSelect, datePicker, timer, sparkline,
} from "../src/index.ts";

// --- controls --------------------------------------------------------------
test("button: variant class, click, disabled reactivity", () => {
  const host = body();
  const dis = signal(false);
  let clicks = 0;
  render(button({ label: "Save", variant: "primary", disabled: () => dis(), onClick: () => clicks++ }), host);
  const btn = host.querySelector("button.dx-btn")!;
  assert.ok(btn.classList.contains("is-primary"));
  fire(btn, "click");
  assert.equal(clicks, 1);
  dis.set(true);
  assert.ok(btn.hasAttribute("disabled"), "disabled toggles reactively");
});

test("buttonGroup + badge render", () => {
  const host = body();
  render(buttonGroup([button({ label: "A" }), button({ label: "B" })]), host);
  assert.equal(host.querySelectorAll(".dx-btn-group .dx-btn").length, 2);
  const h2 = body();
  render(badge("New", "pos"), h2);
  assert.ok(h2.querySelector(".dx-badge.is-pos")!.textContent!.includes("New"));
});

test("input binds value and reports onInput", () => {
  const host = body();
  const v = signal("hi");
  let last = "";
  render(input({ value: () => v(), onInput: (s) => (last = s) }), host);
  const el = host.querySelector("input.dx-input")! as unknown as { value: string };
  assert.equal(el.value, "hi");
  (el as unknown as HTMLInputElement).value = "bye";
  fire(el as unknown as Element, "input");
  assert.equal(last, "bye");
});

test("field shows reactive error and wires aria-describedby", () => {
  const host = body();
  const err = signal<string | false>(false);
  render(field({ label: "Email", error: () => err() }), host);
  assert.equal(host.querySelector(".dx-field-msg.is-error"), null);
  err.set("required");
  const msg = host.querySelector(".dx-field-msg.is-error")!;
  assert.equal(msg.getAttribute("role"), "alert");
  const inputEl = host.querySelector("input.dx-input")!;
  assert.equal(inputEl.getAttribute("aria-describedby"), msg.getAttribute("id"));
});

test("textarea + select render with options", () => {
  const h1 = body();
  render(textarea({ rows: 4, placeholder: "note" }), h1);
  assert.equal(h1.querySelector("textarea.dx-textarea")!.getAttribute("rows"), "4");
  const h2 = body();
  let picked = "";
  render(select({ options: [{ value: "a", label: "A" }, { value: "b", label: "B" }], onChange: (v) => (picked = v) }), h2);
  const sel = h2.querySelector("select.dx-select")! as unknown as HTMLSelectElement;
  assert.equal(h2.querySelectorAll("option").length, 2);
  sel.value = "b";
  fire(sel as unknown as Element, "change");
  assert.equal(picked, "b");
});

test("switchToggle reflects aria-checked and toggles", () => {
  const host = body();
  const on = signal(false);
  render(switchToggle({ checked: () => on(), onChange: (c) => on.set(c), label: "Dark" }), host);
  const sw = host.querySelector(".dx-switch")!;
  assert.equal(sw.getAttribute("aria-checked"), "false");
  fire(sw, "click");
  assert.equal(on(), true);
  assert.equal(sw.getAttribute("aria-checked"), "true");
});

test("checkbox + radioGroup fire change", () => {
  const h1 = body();
  let c = false;
  render(checkbox({ checked: () => c, onChange: (x) => (c = x), label: "Agree" }), h1);
  const cb = h1.querySelector(".dx-check-input")! as unknown as HTMLInputElement;
  cb.checked = true;
  fire(cb as unknown as Element, "change");
  assert.equal(c, true);

  const h2 = body();
  let r = "";
  render(radioGroup({ options: [{ value: "x", label: "X" }, { value: "y", label: "Y" }], value: () => r, onChange: (v) => (r = v) }), h2);
  assert.equal(h2.querySelectorAll(".dx-radio").length, 2);
  const second = h2.querySelectorAll(".dx-radio-input")[1]! as unknown as Element;
  fire(second, "change");
  assert.equal(r, "y");
});

// --- feedback --------------------------------------------------------------
test("alert dismiss + modal hidden toggle", () => {
  const h1 = body();
  let dismissed = 0;
  render(alert({ tone: "warn", title: "Heads up", body: "x", onDismiss: () => dismissed++ }), h1);
  assert.ok(h1.querySelector(".dx-alert.is-warn"));
  fire(h1.querySelector(".dx-alert-x")!, "click");
  assert.equal(dismissed, 1);

  const h2 = body();
  const open = signal(false);
  render(modal({ open: () => open(), title: "Confirm", body: "sure?", onClose: () => open.set(false) }), h2);
  const back = h2.querySelector(".dx-modal-backdrop")!;
  assert.ok(back.hasAttribute("hidden"));
  open.set(true);
  assert.equal(back.hasAttribute("hidden"), false);
  assert.equal(h2.querySelector(".dx-modal")!.getAttribute("aria-modal"), "true");
});

test("tooltip, skeleton, spinner, progress, meter, emptyState render", () => {
  const h = body();
  render(tooltip({ tip: "Help", children: "?" }), h);
  assert.equal(h.querySelector(".dx-tip")!.getAttribute("role"), "tooltip");

  const h2 = body();
  render(skeleton({ kind: "line", lines: 3 }), h2);
  assert.equal(h2.querySelectorAll(".dx-skel-line").length, 3);

  const h3 = body();
  render(spinner("busy"), h3);
  assert.equal(h3.querySelector(".dx-spinner")!.getAttribute("aria-label"), "busy");

  const h4 = body();
  const val = signal(40);
  render(progress({ value: () => val(), showValue: true }), h4);
  const bar = h4.querySelector("progress.dx-progress")! as unknown as HTMLProgressElement;
  assert.equal(bar.getAttribute("value"), "40");
  val.set(80);
  assert.equal(bar.getAttribute("value"), "80");

  const h5 = body();
  render(meter({ value: () => 0.5, tone: "warn", label: "cpu" }), h5);
  assert.equal(h5.querySelector(".dx-meter-fill")!.getAttribute("width"), "50");

  const h6 = body();
  let acted = 0;
  render(emptyState({ title: "Nothing here", description: "add one", action: { label: "New", onClick: () => acted++ } }), h6);
  fire(h6.querySelector(".dx-empty .dx-btn")!, "click");
  assert.equal(acted, 1);
});

// --- nav -------------------------------------------------------------------
test("tabs reflect active + fire select; segmented too", () => {
  const h = body();
  const active = signal("one");
  render(tabs({ tabs: [{ id: "one", label: "One" }, { id: "two", label: "Two", count: 3 }], active: () => active(), onSelect: (id) => active.set(id) }), h);
  const t2 = [...h.querySelectorAll(".dx-tab")].find((b) => b.textContent!.includes("Two"))!;
  assert.equal(t2.getAttribute("aria-selected"), "false");
  fire(t2, "click");
  assert.equal(active(), "two");
  assert.equal(t2.getAttribute("aria-selected"), "true");

  const h2 = body();
  const seg = signal("a");
  render(segmented({ options: [{ value: "a", label: "A" }, { value: "b", label: "B" }], value: () => seg(), onChange: (v) => seg.set(v) }), h2);
  fire([...h2.querySelectorAll(".dx-seg-item")][1]!, "click");
  assert.equal(seg(), "b");
});

test("breadcrumb, navPanel, avatar, divider", () => {
  const h = body();
  let went = 0;
  render(breadcrumb([{ label: "Home", onClick: () => went++ }, { label: "Now" }]), h);
  assert.equal(h.querySelector(".dx-crumb.is-current")!.getAttribute("aria-current"), "page");
  fire(h.querySelector(".dx-link-btn")!, "click");
  assert.equal(went, 1);

  const h2 = body();
  const act = signal("dash");
  render(navPanel({ groups: [{ label: "Main", items: [{ id: "dash", label: "Dashboard" }, { id: "set", label: "Settings", badge: 2 }] }], active: () => act(), onSelect: (id) => act.set(id) }), h2);
  const setBtn = [...h2.querySelectorAll(".dx-pnav-item")].find((b) => b.textContent!.includes("Settings"))!;
  fire(setBtn, "click");
  assert.equal(act(), "set");
  assert.ok(setBtn.classList.contains("is-active"));

  const h3 = body();
  render(avatar({ initials: "WT", name: "Walter", size: "lg" }), h3);
  assert.ok(h3.querySelector(".dx-avatar2.is-lg")!.textContent!.includes("WT"));

  const h4 = body();
  render(divider("OR"), h4);
  assert.ok(h4.querySelector(".dx-divider.has-label span")!.textContent!.includes("OR"));
});

// --- pickers + sparkline ---------------------------------------------------
test("searchableSelect: open, filter, multi pick", () => {
  const h = body();
  const value = signal<string[]>([]);
  render(searchableSelect({ multiple: true, options: [{ value: "a", label: "Apple" }, { value: "b", label: "Banana" }, { value: "c", label: "Cherry" }], value: () => value(), onChange: (v) => value.set(v as string[]) }), h);
  const pop = h.querySelector(".dx-s2-pop")!;
  assert.ok(pop.hasAttribute("hidden"));
  fire(h.querySelector(".dx-s2-face")!, "click");
  assert.equal(pop.hasAttribute("hidden"), false);
  // filter to Banana
  const search = h.querySelector(".dx-s2-search")! as unknown as HTMLInputElement;
  search.value = "ban";
  fire(search as unknown as Element, "input");
  const opts = h.querySelectorAll(".dx-s2-opt");
  assert.equal(opts.length, 1);
  fire(opts[0]!, "click");
  assert.deepEqual(value(), ["b"]);
});

test("datePicker: opens, shows grid, selects a day", () => {
  const h = body();
  const d = signal("2026-03-15");
  render(datePicker({ value: () => d(), onChange: (iso) => d.set(iso) }), h);
  fire(h.querySelector(".dx-dp-face")!, "click");
  assert.equal(h.querySelector(".dx-dp-pop")!.hasAttribute("hidden"), false);
  // March 2026 title
  assert.ok(h.querySelector(".dx-dp-title")!.textContent!.includes("2026"));
  const selected = h.querySelector(".dx-dp-cell.is-selected")!;
  assert.equal(selected.textContent, "15");
  // pick day 20
  const cell20 = [...h.querySelectorAll(".dx-dp-cell")].find((c) => c.textContent === "20" && !c.classList.contains("is-empty"))!;
  fire(cell20, "click");
  assert.equal(d(), "2026-03-20");
});

test("timer formats mm:ss and sparkline emits polyline points", () => {
  const h = body();
  render(timer({ mode: "countdown", seconds: 90, controls: true }), h);
  assert.equal(h.querySelector(".dx-timer-face")!.textContent, "01:30");

  const h2 = body();
  render(sparkline({ data: [1, 5, 2, 8, 4], fill: true, dot: true }), h2);
  const line = h2.querySelector(".dx-spark-line")!;
  const pts = line.getAttribute("points")!;
  assert.equal(pts.split(" ").length, 5, "one coord per data point");
  assert.ok(h2.querySelector(".dx-spark-fill"));
  assert.ok(h2.querySelector(".dx-spark-dot"));
});
