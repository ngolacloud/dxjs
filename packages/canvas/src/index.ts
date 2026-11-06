// @dxjs/canvas — reactive node-graph for data pipelines / architecture diagrams.
// Model + geometry + Canvas-2D renderer + pointer controller. See DESIGN.md §13 (F5).

export { createGraph } from "./model.ts";
export type { Graph, GraphNode, Port, PortKind, Edge, EndPoint, GraphState } from "./model.ts";

export {
  screenToWorld,
  worldToScreen,
  nodeBounds,
  hitTestNode,
  hitTestPort,
  portPosition,
  edgePath,
  boundingBox,
} from "./geometry.ts";
export type { Viewport, Point, Rect, BezierPath } from "./geometry.ts";

export { draw, defaultTheme } from "./render.ts";
export type { Ctx2D, Theme, DrawOptions } from "./render.ts";

export { createController } from "./interaction.ts";
export type { Controller, ControllerOptions, PendingConnection } from "./interaction.ts";
