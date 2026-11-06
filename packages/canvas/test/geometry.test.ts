import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createGraph,
  screenToWorld,
  worldToScreen,
  hitTestNode,
  hitTestPort,
  portPosition,
  edgePath,
  boundingBox,
  type GraphNode,
  type Viewport,
} from "../src/index.ts";

const mk = (id: string, x: number, y: number, ports: GraphNode["ports"] = []): GraphNode => ({
  id, x, y, width: 100, height: 60, label: id, ports,
});

test("screen/world transforms are inverse", () => {
  const v: Viewport = { x: 30, y: -10, zoom: 2 };
  const w = screenToWorld(v, 130, 90);
  assert.deepEqual(w, { x: 50, y: 50 });
  assert.deepEqual(worldToScreen(v, w.x, w.y), { x: 130, y: 90 });
});

test("hitTestNode returns the topmost node (later = on top)", () => {
  const a = mk("a", 0, 0);
  const b = mk("b", 50, 20); // overlaps a
  assert.equal(hitTestNode([a, b], 60, 30)!.id, "b");
  assert.equal(hitTestNode([a, b], 10, 10)!.id, "a");
  assert.equal(hitTestNode([a, b], 999, 999), null);
});

test("portPosition places in-ports left, out-ports right, evenly", () => {
  const n = mk("a", 0, 0, [
    { id: "i1", kind: "in" },
    { id: "o1", kind: "out" },
    { id: "o2", kind: "out" },
  ]);
  assert.deepEqual(portPosition(n, n.ports[0]!), { x: 0, y: 30 }); // single in → mid
  assert.deepEqual(portPosition(n, n.ports[1]!), { x: 100, y: 20 }); // out 1 of 2
  assert.deepEqual(portPosition(n, n.ports[2]!), { x: 100, y: 40 }); // out 2 of 2
});

test("hitTestPort finds a port within radius", () => {
  const n = mk("a", 0, 0, [{ id: "o", kind: "out" }]);
  assert.equal(hitTestPort([n], 103, 31, 8)!.port.id, "o");
  assert.equal(hitTestPort([n], 50, 50, 8), null);
});

test("edgePath computes horizontal bezier handles", () => {
  const g = createGraph();
  g.addNode(mk("a", 0, 0, [{ id: "o", kind: "out" }]));
  g.addNode(mk("b", 200, 0, [{ id: "i", kind: "in" }]));
  const e = g.connect({ node: "a", port: "o" }, { node: "b", port: "i" })!;
  const p = edgePath(g, e)!;
  assert.deepEqual(p, { x1: 100, y1: 30, c1x: 150, c1y: 30, c2x: 150, c2y: 30, x2: 200, y2: 30 });
});

test("boundingBox spans all nodes", () => {
  assert.equal(boundingBox([]), null);
  assert.deepEqual(boundingBox([mk("a", 0, 0), mk("b", 200, 40)]), { x: 0, y: 0, w: 300, h: 100 });
});
