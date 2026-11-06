// @dxjs/canvas/geometry — pure geometry: coordinate transforms, hit-testing, and
// edge path computation. No DOM — fully unit-testable.

import type { Graph, GraphNode, Edge, Port } from "./model.ts";

export interface Viewport {
  x: number; // pan offset (screen px)
  y: number;
  zoom: number;
}
export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Screen (canvas) pixel → world coordinate. */
export function screenToWorld(v: Viewport, px: number, py: number): Point {
  return { x: (px - v.x) / v.zoom, y: (py - v.y) / v.zoom };
}
/** World coordinate → screen (canvas) pixel. */
export function worldToScreen(v: Viewport, wx: number, wy: number): Point {
  return { x: wx * v.zoom + v.x, y: wy * v.zoom + v.y };
}

export function nodeBounds(n: GraphNode): Rect {
  return { x: n.x, y: n.y, w: n.width, h: n.height };
}

function contains(r: Rect, wx: number, wy: number): boolean {
  return wx >= r.x && wx <= r.x + r.w && wy >= r.y && wy <= r.y + r.h;
}

/** Topmost node containing the world point, or null. Later nodes draw on top. */
export function hitTestNode(nodes: GraphNode[], wx: number, wy: number): GraphNode | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i] as GraphNode;
    if (contains(nodeBounds(n), wx, wy)) return n;
  }
  return null;
}

/** World anchor of a port: `in` ports on the left edge, `out` on the right, each
 * kind distributed evenly down the node's height. */
export function portPosition(node: GraphNode, port: Port): Point {
  const same = node.ports.filter((p) => p.kind === port.kind);
  const index = same.indexOf(port);
  const y = node.y + ((index + 1) / (same.length + 1)) * node.height;
  const x = port.kind === "in" ? node.x : node.x + node.width;
  return { x, y };
}

/** Find a port whose anchor is within `radius` world units of the point. */
export function hitTestPort(
  nodes: GraphNode[],
  wx: number,
  wy: number,
  radius = 8,
): { node: GraphNode; port: Port } | null {
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i] as GraphNode;
    for (const port of n.ports) {
      const p = portPosition(n, port);
      if ((p.x - wx) ** 2 + (p.y - wy) ** 2 <= radius * radius) return { node: n, port };
    }
  }
  return null;
}

export interface BezierPath {
  x1: number;
  y1: number;
  c1x: number;
  c1y: number;
  c2x: number;
  c2y: number;
  x2: number;
  y2: number;
}

/** Cubic-bezier path (world coords) from an edge's out-port to its in-port, with
 * horizontal control handles for a smooth left→right flow. */
export function edgePath(graph: Graph, edge: Edge): BezierPath | null {
  const fromNode = graph.node(edge.from.node);
  const toNode = graph.node(edge.to.node);
  if (!fromNode || !toNode) return null;
  const fromPort = fromNode.ports.find((p) => p.id === edge.from.port);
  const toPort = toNode.ports.find((p) => p.id === edge.to.port);
  if (!fromPort || !toPort) return null;
  const a = portPosition(fromNode, fromPort);
  const b = portPosition(toNode, toPort);
  const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
  return { x1: a.x, y1: a.y, c1x: a.x + dx, c1y: a.y, c2x: b.x - dx, c2y: b.y, x2: b.x, y2: b.y };
}

/** Bounding box of all nodes (world coords), or null if empty. */
export function boundingBox(nodes: GraphNode[]): Rect | null {
  if (!nodes.length) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + n.width);
    maxY = Math.max(maxY, n.y + n.height);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
