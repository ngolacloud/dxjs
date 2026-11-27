import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { commandPalette, type CommandGroup } from "../src/command.ts";

const key = (el: Element, k: string): void =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

const typeInto = (input: Element, value: string): void => {
  (input as HTMLInputElement).value = value;
  fire(input, "input");
};

const sampleGroups = (sink: { ran: string }): CommandGroup[] => [
  {
    heading: "Navigation",
    items: [
      { id: "home", label: "Go to Home", icon: "home", shortcut: "G H", onRun: () => (sink.ran = "home") },
      { id: "search", label: "Search", icon: "search", keywords: ["find", "lookup"], onRun: () => (sink.ran = "search") },
    ],
  },
  {
    heading: "Actions",
    items: [
      { id: "new", label: "New file", icon: "plus", hint: "create", shortcut: "⌘N", onRun: () => (sink.ran = "new") },
      { id: "del", label: "Delete", icon: "trash", onRun: () => (sink.ran = "del") },
    ],
  },
];

test("command: hidden when closed, dialog + listbox when open", () => {
  const host = body();
  const open = signal(false);
  const sink = { ran: "" };
  render(commandPalette({ open: () => open(), onClose: () => open.set(false), groups: sampleGroups(sink) }), host);

  const root = host.querySelector(".dx-cmd-root")!;
  assert.ok(root.hasAttribute("hidden"));

  open.set(true);
  assert.equal(root.hasAttribute("hidden"), false);
  assert.ok(root.classList.contains("is-open"));

  const dialog = host.querySelector(".dx-cmd")!;
  assert.equal(dialog.getAttribute("role"), "dialog");
  assert.equal(dialog.getAttribute("aria-modal"), "true");

  const listbox = host.querySelector(".dx-cmd-list")!;
  assert.equal(listbox.getAttribute("role"), "listbox");
  assert.equal(host.querySelectorAll(".dx-cmd-item[role='option']").length, 4);
  assert.equal(host.querySelectorAll(".dx-cmd-group").length, 2);
  assert.equal(host.querySelectorAll(".dx-cmd-head").length, 2);

  // The combobox points at the first option by default.
  const input = host.querySelector(".dx-cmd-input")!;
  assert.equal(input.getAttribute("role"), "combobox");
  const first = host.querySelector(".dx-cmd-item")!;
  assert.equal(input.getAttribute("aria-activedescendant"), first.getAttribute("id"));
  assert.equal(first.getAttribute("aria-selected"), "true");
});

test("command: shows shortcuts as dx-kbd badges", () => {
  const host = body();
  const sink = { ran: "" };
  render(commandPalette({ open: true, groups: sampleGroups(sink) }), host);
  const kbds = [...host.querySelectorAll(".dx-cmd-kbd")].map((k) => k.textContent);
  assert.deepEqual(kbds, ["G H", "⌘N"]);
  assert.ok(host.querySelector(".dx-cmd-kbd.dx-kbd"));
});

test("command: typing filters by label and keywords, dropping empty groups", () => {
  const host = body();
  const sink = { ran: "" };
  render(commandPalette({ open: true, groups: sampleGroups(sink) }), host);
  const input = host.querySelector(".dx-cmd-input")!;

  // "lookup" is a keyword of Search only.
  typeInto(input, "lookup");
  assert.equal(host.querySelectorAll(".dx-cmd-item").length, 1);
  assert.equal(host.querySelector(".dx-cmd-item")!.textContent!.includes("Search"), true);
  // The Actions group has no match left and is gone.
  assert.equal(host.querySelectorAll(".dx-cmd-group").length, 1);

  // Clearing the query restores everything.
  typeInto(input, "");
  assert.equal(host.querySelectorAll(".dx-cmd-item").length, 4);
});

test("command: empty text shown when nothing matches", () => {
  const host = body();
  const sink = { ran: "" };
  render(commandPalette({ open: true, groups: sampleGroups(sink), emptyText: "Nothing here" }), host);
  typeInto(host.querySelector(".dx-cmd-input")!, "zzzzz");
  assert.equal(host.querySelectorAll(".dx-cmd-item").length, 0);
  assert.equal(host.querySelector(".dx-cmd-empty")!.textContent, "Nothing here");
});

test("command: Arrow keys move active across groups, Enter runs it", () => {
  const host = body();
  const open = signal(true);
  const sink = { ran: "" };
  render(commandPalette({ open: () => open(), onClose: () => open.set(false), groups: sampleGroups(sink) }), host);
  const root = host.querySelector(".dx-cmd-root")!;

  const activeLabel = (): string => host.querySelector(".dx-cmd-item.is-active")!.textContent!;
  assert.ok(activeLabel().includes("Go to Home"));

  key(root, "ArrowDown"); // -> Search
  assert.ok(activeLabel().includes("Search"));
  key(root, "ArrowDown"); // crosses into Actions -> New file
  assert.ok(activeLabel().includes("New file"));
  key(root, "ArrowUp"); // back to Search
  assert.ok(activeLabel().includes("Search"));

  // aria-selected follows the active row (exactly one selected).
  assert.equal(host.querySelectorAll(".dx-cmd-item[aria-selected='true']").length, 1);

  key(root, "Enter");
  assert.equal(sink.ran, "search");
  assert.equal(open(), false); // running closes the palette
});

test("command: ArrowUp from the top wraps to the last command", () => {
  const host = body();
  const sink = { ran: "" };
  render(commandPalette({ open: true, groups: sampleGroups(sink) }), host);
  const root = host.querySelector(".dx-cmd-root")!;
  key(root, "ArrowUp"); // wrap to Delete (last)
  assert.ok(host.querySelector(".dx-cmd-item.is-active")!.textContent!.includes("Delete"));
});

test("command: Escape and backdrop click close the palette", () => {
  const host = body();
  let closed = 0;
  const open = signal(true);
  const sink = { ran: "" };
  render(
    commandPalette({
      open: () => open(),
      onClose: () => {
        closed++;
        open.set(false);
      },
      groups: sampleGroups(sink),
    }),
    host,
  );
  const root = host.querySelector(".dx-cmd-root")!;

  key(root, "Escape");
  assert.equal(closed, 1);
  assert.ok(root.hasAttribute("hidden"));

  open.set(true);
  fire(host.querySelector(".dx-cmd-backdrop")!, "click");
  assert.equal(closed, 2);
});

test("command: clicking an option runs it and closes", () => {
  const host = body();
  const open = signal(true);
  const sink = { ran: "" };
  render(commandPalette({ open: () => open(), onClose: () => open.set(false), groups: sampleGroups(sink) }), host);
  const del = [...host.querySelectorAll(".dx-cmd-item")].find((b) => b.textContent!.includes("Delete"))!;
  fire(del, "click");
  assert.equal(sink.ran, "del");
  assert.equal(open(), false);
});
