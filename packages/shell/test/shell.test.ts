import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { html, render } from "@dxjs/dom";
import { createCommandPalette, createToaster, topologyGraph } from "../src/index.ts";

test("command palette filters, keyboard-navigates (clamped), and runs the active command", () => {
  const ran: string[] = [];
  const cmd = (id: string, title: string, keywords = "") => ({ id, title, keywords, run: () => ran.push(id) });
  const palette = createCommandPalette([
    cmd("logs", "Open logs", "tail"),
    cmd("pods", "List pods", "kubernetes"),
    cmd("deploy", "Deploy service"),
  ]);
  palette.show();
  assert.equal(palette.open(), true);
  assert.equal(palette.results().length, 3);

  // Substring filter over title + keywords.
  palette.setQuery("kuber");
  assert.deepEqual(palette.results().map((c) => c.id), ["pods"], "matches keywords");
  palette.setQuery("o"); // "Open logs", "List pods", "Deploy service" all contain 'o'
  assert.ok(palette.results().length >= 2);

  // Keyboard nav clamps at both ends.
  palette.setQuery("");
  assert.equal(palette.active(), 0, "query reset puts highlight at top");
  palette.moveSelection(-1);
  assert.equal(palette.active(), 0, "clamped at the top");
  palette.moveSelection(1);
  palette.moveSelection(1);
  assert.equal(palette.active(), 2);
  palette.moveSelection(1);
  assert.equal(palette.active(), 2, "clamped at the bottom");

  // Running the active command executes it and hides the palette.
  palette.runActive();
  assert.deepEqual(ran, ["deploy"], "the highlighted command ran");
  assert.equal(palette.open(), false, "palette hidden after run");
});

test("command palette view renders results and a click runs the command", () => {
  const ran: string[] = [];
  const palette = createCommandPalette([{ id: "a", title: "Alpha", run: () => ran.push("a") }]);
  palette.show();
  const host = body();
  render(html`${() => palette.view()}`, host);
  const item = host.querySelector(".dx-cmdk-item")!;
  assert.equal(item.textContent, "Alpha");
  item.dispatchEvent(new (globalThis as unknown as { MouseEvent: typeof MouseEvent }).MouseEvent("click", { bubbles: true }));
  assert.deepEqual(ran, ["a"]);
});

test("toasts are idempotent: same key updates in place, distinct keys coexist", () => {
  const t = createToaster();
  t.notify({ key: "deploy", level: "info", text: "Deploying…" });
  t.notify({ key: "deploy", level: "success", text: "Deployed" }); // same key → update
  assert.equal(t.toasts().length, 1, "no duplicate for the same key");
  assert.deepEqual(t.toasts()[0], { key: "deploy", level: "success", text: "Deployed" }, "updated in place");

  t.notify({ key: "warn-disk", level: "warn", text: "Disk 90%" });
  assert.equal(t.toasts().length, 2, "a distinct key adds a toast");

  t.dismiss("deploy");
  assert.deepEqual(t.toasts().map((x) => x.key), ["warn-disk"], "dismiss removes one");
});

test("topologyGraph builds a canvas graph from services + links (invalid skipped)", () => {
  const g = topologyGraph(
    [{ id: "web", label: "web" }, { id: "api", label: "api" }, { id: "db", label: "db" }],
    [
      { from: "web", to: "api" },
      { from: "api", to: "db" },
      { from: "api", to: "ghost" }, // unknown endpoint → skipped
    ],
  );
  assert.equal(g.nodes().length, 3, "one node per service");
  assert.equal(g.edges().length, 2, "valid links only; the ghost link is skipped");
  // Each node carries in/out ports (so canvas can route edges).
  assert.deepEqual(g.node("web")!.ports.map((p) => p.kind).sort(), ["in", "out"]);
});
