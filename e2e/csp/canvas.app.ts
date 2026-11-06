// A dxjs canvas demo — a tiny data pipeline (Source → Transform → Sink) drawn on
// a <canvas>, draggable, served under the SAME strict CSP as the other proof.
// If @dxjs/canvas needed eval/inline it could not run here.
import { signal, effect } from "@dxjs/core";
import { createGraph, createController, draw } from "@dxjs/canvas";

const g = createGraph();
g.addNode({ id: "src", x: 40, y: 60, width: 120, height: 50, label: "Source", ports: [{ id: "o", kind: "out" }] });
g.addNode({
  id: "xf",
  x: 260,
  y: 60,
  width: 120,
  height: 50,
  label: "Transform",
  ports: [{ id: "i", kind: "in" }, { id: "o", kind: "out" }],
});
g.addNode({ id: "sink", x: 480, y: 60, width: 120, height: 50, label: "Sink", ports: [{ id: "i", kind: "in" }] });
g.connect({ node: "src", port: "o" }, { node: "xf", port: "i" });
g.connect({ node: "xf", port: "o" }, { node: "sink", port: "i" });

const viewport = signal({ x: 0, y: 0, zoom: 1 });
const canvas = document.getElementById("c") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const ctrl = createController(g, viewport);

// Redraws whenever the graph or viewport changes (fine-grained, no eval).
effect(() => draw(ctx as unknown as Parameters<typeof draw>[0], g, viewport()));

const rect = (): DOMRect => canvas.getBoundingClientRect();
let down = false;
canvas.addEventListener("mousedown", (e) => {
  down = true;
  const r = rect();
  ctrl.pointerDown(e.clientX - r.left, e.clientY - r.top);
});
window.addEventListener("mousemove", (e) => {
  if (!down) return;
  const r = rect();
  ctrl.pointerMove(e.clientX - r.left, e.clientY - r.top);
});
window.addEventListener("mouseup", (e) => {
  if (!down) return;
  down = false;
  const r = rect();
  ctrl.pointerUp(e.clientX - r.left, e.clientY - r.top);
});

(window as unknown as { __graph: typeof g; __dxready: boolean }).__graph = g;
(window as unknown as { __dxready: boolean }).__dxready = true;
