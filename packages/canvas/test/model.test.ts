import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot, effect } from "@dxjs/core";
import { createGraph, type GraphNode } from "../src/index.ts";

const mk = (id: string, x: number, y: number, ports: GraphNode["ports"] = []): GraphNode => ({
  id,
  x,
  y,
  width: 100,
  height: 60,
  label: id,
  ports,
});

test("add / duplicate / move / update", () => {
  const g = createGraph();
  g.addNode(mk("a", 0, 0));
  assert.equal(g.nodes().length, 1);
  assert.throws(() => g.addNode(mk("a", 5, 5)), /duplicate node id/);
  g.moveNode("a", 10, 20);
  assert.deepEqual([g.node("a")!.x, g.node("a")!.y], [10, 20]);
  g.updateNode("a", { label: "Z" });
  assert.equal(g.node("a")!.label, "Z");
});

test("connect validates direction, self-loop and duplicates", () => {
  const g = createGraph();
  g.addNode(mk("a", 0, 0, [{ id: "o", kind: "out" }]));
  g.addNode(mk("b", 200, 0, [{ id: "i", kind: "in" }]));
  assert.ok(g.connect({ node: "a", port: "o" }, { node: "b", port: "i" }));
  assert.equal(g.edges().length, 1);
  // duplicate
  assert.equal(g.connect({ node: "a", port: "o" }, { node: "b", port: "i" }), null);
  // wrong direction (in → out)
  assert.equal(g.connect({ node: "b", port: "i" }, { node: "a", port: "o" }), null);
  // self-loop
  assert.equal(g.connect({ node: "a", port: "o" }, { node: "a", port: "o" }), null);
  assert.equal(g.edges().length, 1);
});

test("removeNode cascades to its edges", () => {
  const g = createGraph();
  g.addNode(mk("a", 0, 0, [{ id: "o", kind: "out" }]));
  g.addNode(mk("b", 200, 0, [{ id: "i", kind: "in" }]));
  g.connect({ node: "a", port: "o" }, { node: "b", port: "i" });
  g.removeNode("a");
  assert.equal(g.nodes().length, 1);
  assert.equal(g.edges().length, 0, "edges to a removed node are dropped");
});

test("toJSON / load round-trips", () => {
  const g = createGraph();
  g.addNode(mk("a", 1, 2, [{ id: "o", kind: "out" }]));
  g.addNode(mk("b", 3, 4, [{ id: "i", kind: "in" }]));
  g.connect({ node: "a", port: "o" }, { node: "b", port: "i" });
  const json = JSON.parse(JSON.stringify(g.toJSON()));
  const g2 = createGraph();
  g2.load(json);
  assert.deepEqual(g2.toJSON(), g.toJSON());
});

test("graph changes are reactive", () => {
  createRoot((dispose) => {
    const g = createGraph();
    let runs = 0;
    let count = 0;
    effect(() => {
      count = g.nodes().length;
      runs++;
    });
    assert.equal(runs, 1);
    g.addNode(mk("a", 0, 0));
    assert.equal(count, 1);
    assert.equal(runs, 2);
    dispose();
  });
});
