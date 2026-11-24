// @dxjs/devtools — a signals inspector. It installs a @dxjs/core inspector hook
// and keeps a LIVE, reactive snapshot of the reactive graph: every signal,
// computed and effect created while it is active, with its kind, optional name,
// current value and recompute count. A panel can render `nodes()` reactively;
// here we expose the data (the visual panel/extension is a later increment).
//
// Dev-only: installing an inspector is what makes @dxjs/core allocate inspect
// handles; without devtools the core hot path is a single null check.

import { signal, setInspector, type Accessor, type InspectNode } from "@dxjs/core";

export interface DevtoolsNode {
  id: number;
  kind: "signal" | "computed" | "effect";
  name?: string;
  /** Latest value seen (signals + computeds; effects stay undefined). */
  value?: unknown;
  /** How many times a computed/effect has (re)run; 0 for a plain signal. */
  runs: number;
  disposed: boolean;
}

export interface Devtools {
  /** Reactive snapshot of all tracked nodes (newest insertion order). */
  nodes: Accessor<DevtoolsNode[]>;
  /** Only the nodes still live (not disposed). */
  live: Accessor<DevtoolsNode[]>;
  /** Forget everything captured so far. */
  clear(): void;
  /** Uninstall the inspector (restores the zero-cost core path). */
  stop(): void;
}

/**
 * Install the inspector and start capturing. Call BEFORE creating the signals you
 * want to see. Returns a handle whose `nodes()` is a reactive accessor.
 */
export function createDevtools(): Devtools {
  // Created before setInspector → this signal itself is NOT instrumented (no
  // self-observation / feedback loop).
  const map = new Map<number, DevtoolsNode>();
  const snap = signal<DevtoolsNode[]>([]);
  const publish = (): void => snap.set([...map.values()]);

  setInspector({
    onCreate(n: InspectNode): void {
      map.set(n.id, { id: n.id, kind: n.kind, name: n.name, value: undefined, runs: 0, disposed: false });
      publish();
    },
    onUpdate(n: InspectNode, value: unknown): void {
      const d = map.get(n.id);
      if (d) {
        d.value = value;
        publish();
      }
    },
    onRun(n: InspectNode): void {
      const d = map.get(n.id);
      if (d) {
        d.runs += 1;
        publish();
      }
    },
    onDispose(n: InspectNode): void {
      const d = map.get(n.id);
      if (d) {
        d.disposed = true;
        publish();
      }
    },
  });

  return {
    nodes: () => snap(),
    live: () => snap().filter((n) => !n.disposed),
    clear(): void {
      map.clear();
      publish();
    },
    stop(): void {
      setInspector(null);
    },
  };
}
