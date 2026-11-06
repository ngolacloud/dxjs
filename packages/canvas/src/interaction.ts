// @dxjs/canvas/interaction — a pure pointer controller: drag nodes, draw edges
// between ports, pan and zoom the viewport. Operates on the reactive graph and a
// viewport signal, so it is fully testable with synthetic coordinates (no DOM).

import type { Signal } from "@dxjs/core";
import type { Graph, EndPoint } from "./model.ts";
import {
  screenToWorld,
  hitTestNode,
  hitTestPort,
  type Viewport,
  type Point,
} from "./geometry.ts";

export interface ControllerOptions {
  minZoom?: number;
  maxZoom?: number;
  portRadius?: number;
}
export interface PendingConnection {
  from: EndPoint;
  cursor: Point;
}
export interface Controller {
  pointerDown(px: number, py: number): void;
  pointerMove(px: number, py: number): void;
  pointerUp(px: number, py: number): void;
  /** Zoom by `factor` around a screen point (keeps that point fixed). */
  zoomAt(px: number, py: number, factor: number): void;
  /** The in-progress edge while connecting (for a preview), else null. */
  pending(): PendingConnection | null;
}

type Mode = "idle" | "drag" | "pan" | "connect";

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

/** Create a pointer controller bound to a graph and a viewport signal. */
export function createController(
  graph: Graph,
  viewport: Signal<Viewport>,
  options: ControllerOptions = {},
): Controller {
  const minZoom = options.minZoom ?? 0.2;
  const maxZoom = options.maxZoom ?? 4;
  const portRadius = options.portRadius ?? 8;

  let mode: Mode = "idle";
  let nodeId: string | null = null;
  let offset: Point = { x: 0, y: 0 };
  let from: EndPoint | null = null;
  let cursor: Point = { x: 0, y: 0 };
  let last: Point = { x: 0, y: 0 };

  return {
    pointerDown(px, py) {
      const v = viewport();
      const w = screenToWorld(v, px, py);
      const port = hitTestPort(graph.nodes(), w.x, w.y, portRadius);
      if (port && port.port.kind === "out") {
        mode = "connect";
        from = { node: port.node.id, port: port.port.id };
        cursor = w;
        return;
      }
      const n = hitTestNode(graph.nodes(), w.x, w.y);
      if (n) {
        mode = "drag";
        nodeId = n.id;
        offset = { x: w.x - n.x, y: w.y - n.y };
        return;
      }
      mode = "pan";
      last = { x: px, y: py };
    },
    pointerMove(px, py) {
      if (mode === "drag" && nodeId) {
        const w = screenToWorld(viewport(), px, py);
        graph.moveNode(nodeId, w.x - offset.x, w.y - offset.y);
      } else if (mode === "pan") {
        const v = viewport();
        viewport.set({ x: v.x + (px - last.x), y: v.y + (py - last.y), zoom: v.zoom });
        last = { x: px, y: py };
      } else if (mode === "connect") {
        cursor = screenToWorld(viewport(), px, py);
      }
    },
    pointerUp(px, py) {
      if (mode === "connect" && from) {
        const w = screenToWorld(viewport(), px, py);
        const hit = hitTestPort(graph.nodes(), w.x, w.y, portRadius);
        if (hit && hit.port.kind === "in") graph.connect(from, { node: hit.node.id, port: hit.port.id });
      }
      mode = "idle";
      nodeId = null;
      from = null;
    },
    zoomAt(px, py, factor) {
      const v = viewport();
      const w = screenToWorld(v, px, py);
      const zoom = clamp(v.zoom * factor, minZoom, maxZoom);
      viewport.set({ x: px - w.x * zoom, y: py - w.y * zoom, zoom });
    },
    pending() {
      return mode === "connect" && from ? { from, cursor } : null;
    },
  };
}
