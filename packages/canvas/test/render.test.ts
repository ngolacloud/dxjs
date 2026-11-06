import { test } from "node:test";
import assert from "node:assert/strict";
import { createGraph, draw, type Ctx2D, type GraphNode } from "../src/index.ts";

interface Call {
  op: string;
  args: number[] | string[];
}

function mockCtx(width = 800, height = 600): Ctx2D & { calls: Call[] } {
  const calls: Call[] = [];
  const rec = (op: string) => (...args: Array<number | string>) => {
    calls.push({ op, args: args as number[] });
  };
  return {
    calls,
    canvas: { width, height },
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    font: "",
    clearRect: rec("clearRect"),
    save: rec("save"),
    restore: rec("restore"),
    translate: rec("translate"),
    scale: rec("scale"),
    beginPath: rec("beginPath"),
    moveTo: rec("moveTo"),
    bezierCurveTo: rec("bezierCurveTo"),
    arc: rec("arc"),
    rect: rec("rect"),
    fill: rec("fill"),
    stroke: rec("stroke"),
    fillText: rec("fillText") as Ctx2D["fillText"],
  } as Ctx2D & { calls: Call[] };
}

const mk = (id: string, x: number, y: number, ports: GraphNode["ports"] = []): GraphNode => ({
  id, x, y, width: 100, height: 60, label: id, ports,
});

test("draw clears, applies viewport, and emits node/edge/port ops", () => {
  const g = createGraph();
  g.addNode(mk("a", 0, 0, [{ id: "o", kind: "out" }]));
  g.addNode(mk("b", 200, 0, [{ id: "i", kind: "in" }]));
  g.connect({ node: "a", port: "o" }, { node: "b", port: "i" });

  const ctx = mockCtx();
  draw(ctx, g, { x: 5, y: 7, zoom: 1.5 });

  const ops = ctx.calls.map((c) => c.op);
  assert.equal(ops[0], "clearRect");
  assert.deepEqual(ctx.calls[0]!.args, [0, 0, 800, 600]);
  assert.ok(ops.indexOf("save") < ops.indexOf("restore"), "save precedes restore");
  // viewport applied
  assert.deepEqual(ctx.calls.find((c) => c.op === "translate")!.args, [5, 7]);
  assert.deepEqual(ctx.calls.find((c) => c.op === "scale")!.args, [1.5, 1.5]);
  // edge drawn with a bezier
  assert.equal(ops.filter((o) => o === "bezierCurveTo").length, 1);
  // two node rects
  assert.equal(ops.filter((o) => o === "rect").length, 2);
  // two ports → two arcs
  assert.equal(ops.filter((o) => o === "arc").length, 2);
  // labels
  assert.equal(ctx.calls.filter((c) => c.op === "fillText").length, 2);
});

test("empty graph still clears and balances save/restore", () => {
  const ctx = mockCtx(300, 200);
  draw(ctx, createGraph(), { x: 0, y: 0, zoom: 1 });
  const ops = ctx.calls.map((c) => c.op);
  assert.deepEqual(ctx.calls[0]!.args, [0, 0, 300, 200]);
  assert.equal(ops.filter((o) => o === "save").length, 1);
  assert.equal(ops.filter((o) => o === "restore").length, 1);
  assert.equal(ops.filter((o) => o === "rect").length, 0);
});
