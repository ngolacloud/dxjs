// @dxjs/canvas/model — a reactive node-graph for data pipelines / architecture
// diagrams. Nodes carry ports; edges connect an `out` port to an `in` port.
// State lives in signals, so any renderer wrapped in an effect redraws on change.
// Serialises to/from plain JSON for persistence.

import { signal, type Accessor } from "@dxjs/core";

export type PortKind = "in" | "out";
export interface Port {
  id: string;
  kind: PortKind;
  name?: string;
}
export interface GraphNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  ports: Port[];
  data?: unknown;
}
export interface EndPoint {
  node: string;
  port: string;
}
export interface Edge {
  id: string;
  from: EndPoint;
  to: EndPoint;
}
export interface GraphState {
  nodes: GraphNode[];
  edges: Edge[];
}

export interface Graph {
  nodes: Accessor<GraphNode[]>;
  edges: Accessor<Edge[]>;
  node(id: string): GraphNode | undefined;
  addNode(node: GraphNode): void;
  updateNode(id: string, patch: Partial<Omit<GraphNode, "id">>): void;
  moveNode(id: string, x: number, y: number): void;
  removeNode(id: string): void;
  /** Connect an `out` port to an `in` port. Returns the edge, or null if invalid. */
  connect(from: EndPoint, to: EndPoint): Edge | null;
  disconnect(edgeId: string): void;
  toJSON(): GraphState;
  load(state: GraphState): void;
}

const edgeId = (from: EndPoint, to: EndPoint): string =>
  `${from.node}:${from.port}->${to.node}:${to.port}`;

function portOf(node: GraphNode | undefined, portId: string): Port | undefined {
  return node?.ports.find((p) => p.id === portId);
}

/** Create a reactive graph, optionally seeded with state. */
export function createGraph(initial?: GraphState): Graph {
  const nodes = signal<GraphNode[]>(initial ? initial.nodes.slice() : []);
  const edges = signal<Edge[]>(initial ? initial.edges.slice() : []);

  const node = (id: string): GraphNode | undefined => nodes().find((n) => n.id === id);

  return {
    nodes: () => nodes(),
    edges: () => edges(),
    node,
    addNode(n) {
      if (node(n.id)) throw new Error(`dxjs/canvas: duplicate node id "${n.id}"`);
      nodes.set([...nodes(), n]);
    },
    updateNode(id, patch) {
      nodes.set(nodes().map((n) => (n.id === id ? { ...n, ...patch } : n)));
    },
    moveNode(id, x, y) {
      nodes.set(nodes().map((n) => (n.id === id ? { ...n, x, y } : n)));
    },
    removeNode(id) {
      nodes.set(nodes().filter((n) => n.id !== id));
      edges.set(edges().filter((e) => e.from.node !== id && e.to.node !== id));
    },
    connect(from, to) {
      if (from.node === to.node) return null; // no self-loop
      const fromPort = portOf(node(from.node), from.port);
      const toPort = portOf(node(to.node), to.port);
      if (!fromPort || !toPort) return null;
      if (fromPort.kind !== "out" || toPort.kind !== "in") return null; // direction
      const id = edgeId(from, to);
      if (edges().some((e) => e.id === id)) return null; // no duplicate
      const edge: Edge = { id, from, to };
      edges.set([...edges(), edge]);
      return edge;
    },
    disconnect(id) {
      edges.set(edges().filter((e) => e.id !== id));
    },
    toJSON() {
      return { nodes: nodes().map((n) => ({ ...n })), edges: edges().map((e) => ({ ...e })) };
    },
    load(state) {
      nodes.set(state.nodes.slice());
      edges.set(state.edges.slice());
    },
  };
}
