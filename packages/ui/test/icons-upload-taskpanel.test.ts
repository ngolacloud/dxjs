import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { icon, iconNames, fileUpload, formatBytes, taskPanel, type UploadItem, type Task, type TaskGroup } from "../src/index.ts";

// --- Icons -----------------------------------------------------------------
test("icon: decorative by default, titled when given a title", () => {
  const h = body();
  render(icon("home"), h);
  const svg = h.querySelector("svg.dx-icon")!;
  assert.equal(svg.getAttribute("viewBox"), "0 0 24 24");
  assert.equal(svg.getAttribute("stroke"), "currentColor");
  assert.equal(svg.getAttribute("aria-hidden"), "true");
  assert.equal(svg.getAttribute("width"), "20");
  assert.ok(svg.querySelector("path"), "glyph has geometry");

  const h2 = body();
  render(icon("check", { title: "Done", size: 16 }), h2);
  const svg2 = h2.querySelector("svg.dx-icon")!;
  assert.equal(svg2.getAttribute("role"), "img");
  assert.equal(svg2.getAttribute("aria-label"), "Done");
  assert.equal(svg2.hasAttribute("aria-hidden"), false, "titled icon is not hidden");
  assert.equal(svg2.getAttribute("width"), "16");
});

test("iconNames lists every glyph and includes the common ones", () => {
  assert.ok(iconNames.length >= 30);
  for (const n of ["home", "upload", "tasks", "topology", "radar", "moon"]) assert.ok(iconNames.includes(n as never), n);
});

// --- formatBytes -----------------------------------------------------------
test("formatBytes: B/KB/MB thresholds", () => {
  assert.equal(formatBytes(980), "980 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(1048576), "1 MB");
  assert.equal(formatBytes(15 * 1024), "15 KB");
});

// --- fileUpload ------------------------------------------------------------
test("fileUpload: dropzone with hint + file input carrying accept/multiple", () => {
  const h = body();
  render(fileUpload({ hint: "PDF up to 5 MB", accept: ".pdf", multiple: true }), h);
  assert.ok(h.querySelector(".dx-up-zone"));
  assert.equal(h.querySelector(".dx-up-hint")!.textContent, "PDF up to 5 MB");
  const inp = h.querySelector(".dx-up-input")! as unknown as HTMLInputElement;
  assert.equal(inp.getAttribute("type"), "file");
  assert.equal(inp.getAttribute("accept"), ".pdf");
  assert.ok(inp.hasAttribute("multiple"));
});

test("fileUpload: dragover toggles is-drag; drop reports files; maxSize filters", () => {
  const h = body();
  const got: File[][] = [];
  render(fileUpload({ onFiles: (f) => got.push(f), maxSize: 1000 }), h);
  const zone = h.querySelector(".dx-up-zone")!;

  fire(zone, "dragover");
  assert.ok(zone.classList.contains("is-drag"));
  fire(zone, "dragleave");
  assert.equal(zone.classList.contains("is-drag"), false);

  // drop two files; one is over maxSize and is filtered out.
  const drop = new Event("drop", { bubbles: true });
  Object.defineProperty(drop, "dataTransfer", { value: { files: [{ name: "ok.txt", size: 500 }, { name: "big.bin", size: 5000 }] } });
  zone.dispatchEvent(drop);
  assert.equal(got.length, 1);
  assert.deepEqual(got[0]!.map((f) => (f as unknown as { name: string }).name), ["ok.txt"]);
  assert.equal(zone.classList.contains("is-drag"), false, "drop clears the drag state");
});

test("fileUpload: controlled items show size, progress, status; × removes", () => {
  const h = body();
  const items = signal<UploadItem[]>([
    { id: "u1", name: "report.pdf", size: 2048, status: "uploading", progress: 0.5 },
    { id: "u2", name: "logo.png", size: 4096, status: "done" },
    { id: "u3", name: "huge.iso", size: 9999, status: "error", error: "Too large" },
  ]);
  let removed = "";
  render(fileUpload({ items: () => items(), onRemove: (id) => (removed = id) }), h);
  assert.equal(h.querySelectorAll(".dx-up-item").length, 3);
  assert.equal(h.querySelector(".dx-up-name")!.textContent, "report.pdf");
  assert.equal(h.querySelector(".dx-up-size")!.textContent, "2 KB");
  // uploading bar fill = 50
  assert.equal(h.querySelector(".dx-up-bar-fill")!.getAttribute("width"), "50");
  // error row carries its message
  assert.equal(h.querySelector(".dx-up-item.is-error .dx-up-msg")!.textContent, "Too large");
  // remove the first
  fire(h.querySelector(".dx-up-x")!, "click");
  assert.equal(removed, "u1");
});

// --- taskPanel -------------------------------------------------------------
test("taskPanel: flat list renders count + rows; toggle and select fire", () => {
  const h = body();
  const tasks = signal<Task[]>([
    { id: "t1", title: "Write spec", assignee: "AO", due: "Fri", priority: "high", progress: 0.3 },
    { id: "t2", title: "Review PR", done: true },
  ]);
  let toggled = "";
  let picked = "";
  render(
    taskPanel({ title: "Sprint", tasks: () => tasks(), onToggle: (id, done) => (toggled = `${id}:${done}`), onSelect: (id) => (picked = id) }),
    h,
  );
  assert.equal(h.querySelector(".dx-tp-htitle")!.textContent, "Sprint");
  assert.equal(h.querySelector(".dx-tp-count")!.textContent, "2");
  assert.equal(h.querySelectorAll(".dx-tp-task").length, 2);
  // high priority badge tone
  assert.ok(h.querySelector(".dx-tp-pri.is-neg"));
  // done task is struck
  assert.ok([...h.querySelectorAll(".dx-tp-task")][1]!.classList.contains("is-done"));
  // toggle the first task's checkbox
  const cb = h.querySelector(".dx-tp-check input")! as unknown as HTMLInputElement;
  cb.checked = true;
  fire(cb, "change");
  assert.equal(toggled, "t1:true");
  // select via the main button
  fire(h.querySelector(".dx-tp-main")!, "click");
  assert.equal(picked, "t1");
});

test("taskPanel: grouped sections render with per-group counts", () => {
  const h = body();
  const groups: TaskGroup[] = [
    { label: "To do", tasks: [{ id: "a", title: "A" }, { id: "b", title: "B" }] },
    { label: "Done", tasks: [{ id: "c", title: "C", done: true }] },
  ];
  render(taskPanel({ groups }), h);
  assert.equal(h.querySelectorAll(".dx-tp-group").length, 2);
  assert.equal(h.querySelector(".dx-tp-count")!.textContent, "3", "header counts all tasks across groups");
  const counts = [...h.querySelectorAll(".dx-tp-groupcount")].map((n) => n.textContent);
  assert.deepEqual(counts, ["2", "1"]);
});
