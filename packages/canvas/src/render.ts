// @dxjs/canvas/render — draw a graph onto a Canvas 2D context under a viewport.
// Reads the reactive graph, so wrapping `draw` in an effect redraws on change.
// Depends only on the 2D context API → testable with a recording mock.

import type { Graph } from "./model.ts";
import { edgePath, portPosition, type Viewport } from "./geometry.ts";

/** The subset of CanvasRenderingContext2D the renderer uses. */
export interface Ctx2D {
  canvas?: { width: number; height: number };
  fillStyle: string;
  strokeStyle: string;
  lineWidth: number;
  font: string;
  clearRect(x: number, y: number, w: number, h: number): void;
  save(): void;
  restore(): void;
  translate(x: number, y: number): void;
  scale(x: number, y: number): void;
  beginPath(): void;
  moveTo(x: number, y: number): void;
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number): void;
  arc(x: number, y: number, r: number, s: number, e: number): void;
  rect(x: number, y: number, w: number, h: number): void;
  fill(): void;
  stroke(): void;
  fillText(text: string, x: number, y: number): void;
}

export interface Theme {
  node: string;
  nodeBorder: string;
  text: string;
  edge: string;
  port: string;
}
export const defaultTheme: Theme = {
  node: "#1f2937",
  nodeBorder: "#374151",
  text: "#e5e7eb",
  edge: "#60a5fa",
  port: "#93c5fd",
};

export interface DrawOptions {
  width?: number;
  height?: number;
  theme?: Theme;
}

/** Draw the graph. Clears the surface, applies the viewport, then edges, nodes, ports. */
export function draw(ctx: Ctx2D, graph: Graph, view: Viewport, options: DrawOptions = {}): void {
  const theme = options.theme ?? defaultTheme;
  const w = ctx.canvas?.width ?? options.width ?? 0;
  const h = ctx.canvas?.height ?? options.height ?? 0;

  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(view.x, view.y);
  ctx.scale(view.zoom, view.zoom);

  // Edges first (under nodes).
  ctx.strokeStyle = theme.edge;
  ctx.lineWidth = 2;
  for (const e of graph.edges()) {
    const p = edgePath(graph, e);
    if (!p) continue;
    ctx.beginPath();
    ctx.moveTo(p.x1, p.y1);
    ctx.bezierCurveTo(p.c1x, p.c1y, p.c2x, p.c2y, p.x2, p.y2);
    ctx.stroke();
  }

  // Nodes + ports + label.
  for (const n of graph.nodes()) {
    ctx.beginPath();
    ctx.rect(n.x, n.y, n.width, n.height);
    ctx.fillStyle = theme.node;
    ctx.fill();
    ctx.strokeStyle = theme.nodeBorder;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = theme.text;
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText(n.label, n.x + 8, n.y + 16);

    ctx.fillStyle = theme.port;
    for (const port of n.ports) {
      const pp = portPosition(n, port);
      ctx.beginPath();
      ctx.arc(pp.x, pp.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.restore();
}
