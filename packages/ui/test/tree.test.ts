import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { tree, type TreeNode } from "../src/tree.ts";

const key = (el: Element, k: string): void =>
  el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));

const sample: TreeNode[] = [
  {
    id: "src",
    label: "src",
    icon: "folder",
    children: [
      { id: "base", label: "base.ts", icon: "file-text" },
      {
        id: "ui",
        label: "ui",
        children: [
          { id: "tree", label: "tree.ts", icon: "file-text" },
          { id: "locked", label: "locked.ts", disabled: true },
        ],
      },
    ],
  },
  { id: "readme", label: "README.md" },
];

test("tree: role=tree, treeitems carry level, parents expose aria-expanded, leaves do not", () => {
  const host = body();
  render(tree({ nodes: sample }), host);

  const root = host.querySelector(".dx-tree")!;
  assert.equal(root.getAttribute("role"), "tree");

  const items = [...host.querySelectorAll('[role="treeitem"]')];
  // Collapsed: only the two roots render their rows; children live inside groups
  // (also in the DOM but inside a hidden group).
  const src = items.find((i) => i.textContent!.includes("src"))!;
  assert.equal(src.getAttribute("aria-level"), "1");
  assert.equal(src.getAttribute("aria-expanded"), "false");

  const readme = items.find((i) => i.querySelector(".dx-tree-label")!.textContent === "README.md")!;
  assert.equal(readme.getAttribute("aria-level"), "1");
  // A leaf never advertises aria-expanded.
  assert.equal(readme.hasAttribute("aria-expanded"), false);
  // A leaf with no icon gets a dot.
  assert.ok(readme.querySelector(".dx-tree-dot"));
});

test("tree: group is hidden until expanded; clicking the chevron toggles it", () => {
  const host = body();
  const toggled: Array<[string, boolean]> = [];
  render(tree({ nodes: sample, onToggle: (id, open) => toggled.push([id, open]) }), host);

  const src = [...host.querySelectorAll('[role="treeitem"]')].find((i) =>
    i.querySelector(".dx-tree-label")!.textContent === "src",
  )!;
  const group = src.querySelector(".dx-tree-group")!;
  assert.equal(group.getAttribute("role"), "group");
  assert.ok(group.hasAttribute("hidden"));

  const chevron = src.querySelector(".dx-tree-chevron")!;
  assert.equal(chevron.classList.contains("is-open"), false);

  fire(chevron, "click");
  assert.equal(group.hasAttribute("hidden"), false);
  assert.equal(src.getAttribute("aria-expanded"), "true");
  assert.ok(src.querySelector(".dx-tree-chevron")!.classList.contains("is-open"));
  assert.deepEqual(toggled, [["src", true]]);

  // Chevron click must not bubble into a selection.
  fire(chevron, "click");
  assert.ok(group.hasAttribute("hidden"));
  assert.deepEqual(toggled, [["src", true], ["src", false]]);
});

test("tree: clicking a leaf selects it; selected row reflects aria-selected", () => {
  const host = body();
  const selected = signal("");
  const picks: string[] = [];
  render(
    tree({
      nodes: sample,
      selected: () => selected(),
      defaultExpanded: ["src", "ui"],
      onSelect: (id) => {
        picks.push(id);
        selected.set(id);
      },
    }),
    host,
  );

  // Expanded by default, so the nested leaf is visible and selectable.
  const treeFile = [...host.querySelectorAll('[role="treeitem"]')].find((i) =>
    i.querySelector(".dx-tree-label")!.textContent === "tree.ts",
  )!;
  assert.equal(treeFile.getAttribute("aria-level"), "3");

  fire(treeFile, "click");
  assert.deepEqual(picks, ["tree"]);
  assert.equal(treeFile.getAttribute("aria-selected"), "true");
  assert.ok(treeFile.querySelector(".dx-tree-row")!.classList.contains("is-selected"));
});

test("tree: Enter toggles a focused parent; Space selects a focused leaf", () => {
  const host = body();
  const picks: string[] = [];
  const toggled: Array<[string, boolean]> = [];
  render(
    tree({
      nodes: sample,
      defaultExpanded: ["src"],
      onSelect: (id) => picks.push(id),
      onToggle: (id, open) => toggled.push([id, open]),
    }),
    host,
  );

  const items = [...host.querySelectorAll('[role="treeitem"]')];
  const src = items.find((i) => i.querySelector(".dx-tree-label")!.textContent === "src")!;
  // Enter on a parent selects AND toggles it.
  key(src, "Enter");
  assert.deepEqual(picks, ["src"]);
  assert.deepEqual(toggled, [["src", false]]);

  // Space on a visible leaf selects it (no toggle).
  const base = items.find((i) => i.querySelector(".dx-tree-label")!.textContent === "base.ts")!;
  key(base, " ");
  assert.deepEqual(picks, ["src", "base"]);
  assert.deepEqual(toggled, [["src", false]]);
});

test("tree: ArrowRight/ArrowLeft expand and collapse; a disabled node ignores keys/clicks", () => {
  const host = body();
  const picks: string[] = [];
  render(
    tree({ nodes: sample, defaultExpanded: ["src"], onSelect: (id) => picks.push(id) }),
    host,
  );

  const ui = [...host.querySelectorAll('[role="treeitem"]')].find((i) =>
    i.querySelector(".dx-tree-label")!.textContent === "ui",
  )!;
  assert.equal(ui.getAttribute("aria-expanded"), "false");
  key(ui, "ArrowRight");
  assert.equal(ui.getAttribute("aria-expanded"), "true");
  key(ui, "ArrowRight"); // already open — no-op
  assert.equal(ui.getAttribute("aria-expanded"), "true");
  key(ui, "ArrowLeft");
  assert.equal(ui.getAttribute("aria-expanded"), "false");

  // Re-open ui to reach the disabled leaf.
  key(ui, "ArrowRight");
  const locked = [...host.querySelectorAll('[role="treeitem"]')].find((i) =>
    i.querySelector(".dx-tree-label")!.textContent === "locked.ts",
  )!;
  assert.equal(locked.getAttribute("aria-disabled"), "true");
  fire(locked, "click");
  key(locked, "Enter");
  assert.equal(picks.length, 0);
});

test("tree: roving tabindex puts the tabbable row first, then the selected one", () => {
  const host = body();
  const selected = signal("");
  render(tree({ nodes: sample, selected: () => selected(), defaultExpanded: ["src"] }), host);

  const items = [...host.querySelectorAll('[role="treeitem"]')];
  const src = items.find((i) => i.querySelector(".dx-tree-label")!.textContent === "src")!;
  const readme = items.find((i) => i.querySelector(".dx-tree-label")!.textContent === "README.md")!;
  // No selection: the first root is tabbable.
  assert.equal(src.getAttribute("tabindex"), "0");
  assert.equal(readme.getAttribute("tabindex"), "-1");

  // Selecting README moves the tabstop.
  selected.set("readme");
  assert.equal(src.getAttribute("tabindex"), "-1");
  assert.equal(readme.getAttribute("tabindex"), "0");
});
