import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { createGraph, createController, type GraphNode, type Viewport } from "../src/index.ts";

const mk = (id: string, x: number, y: number, ports: GraphNode["ports"] = []): GraphNode => ({
  id, x, y, width: 100, height: 60, label: id, ports,
});

function setup() {
  const g = createGraph();
  const vp = signal<Viewport>({ x: 0, y: 0, zoom: 1 });
  const c = createController(g, vp);
  return { g, vp, c };
}

test("dragging a node moves it in world space", () => {
  const { g, c } = setup();
  g.addNode(mk("a", 0, 0));
  c.pointerDown(50, 30); // inside node a
  c.pointerMove(70, 40);
  c.pointerUp(70, 40);
  assert.deepEqual([g.node("a")!.x, g.node("a")!.y], [20, 10]);
});

test("dragging from an out-port to an in-port creates an edge", () => {
  const { g, c } = setup();
  g.addNode(mk("a", 0, 0, [{ id: "o", kind: "out" }])); // out port at (100,30)
  g.addNode(mk("b", 200, 0, [{ id: "i", kind: "in" }])); // in port at (200,30)
  c.pointerDown(100, 30);
  assert.ok(c.pending(), "a connection is in progress");
  c.pointerMove(150, 30);
  c.pointerUp(200, 30);
  assert.equal(g.edges().length, 1);
  assert.equal(c.pending(), null);
});

test("connection to empty space creates nothing", () => {
  const { g, c } = setup();
  g.addNode(mk("a", 0, 0, [{ id: "o", kind: "out" }]));
  c.pointerDown(100, 30);
  c.pointerUp(400, 400);
  assert.equal(g.edges().length, 0);
});

test("panning empty canvas shifts the viewport", () => {
  const { vp, c } = setup();
  c.pointerDown(300, 300); // empty
  c.pointerMove(310, 320);
  assert.deepEqual(vp(), { x: 10, y: 20, zoom: 1 });
});

test("zoomAt keeps the point under the cursor fixed", () => {
  const { vp, c } = setup();
  c.zoomAt(100, 100, 2);
  assert.deepEqual(vp(), { x: -100, y: -100, zoom: 2 });
});
