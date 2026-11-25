// @dxjs/k8s — a Kubernetes resource explorer for the Cloud Shell.
//
// `createResourceStore` holds a live, keyed (by uid) collection of objects and
// applies watch events with real watch semantics: ADDED/MODIFIED upsert,
// DELETED removes, and the latest `resourceVersion` is tracked as the resume
// cursor (so a dropped watch can reconnect with `?resourceVersion=…` and not miss
// or replay). `reset()` seeds from an initial LIST. `resourceExplorer` renders the
// collection with @dxjs/ui's dataTable — sort/search/paginate for free — and it
// updates live as events arrive. Feed `apply()` from any watch stream (e.g. a
// @dxjs/transport LiveSource topic); the store is transport-agnostic.

import { signal, computed, type Accessor } from "@dxjs/core";
import { type TemplateResult } from "@dxjs/dom";
import { dataTable, type Column } from "@dxjs/ui";

export type WatchEventType = "ADDED" | "MODIFIED" | "DELETED";

export interface K8sObject {
  kind?: string;
  apiVersion?: string;
  metadata: {
    name: string;
    namespace?: string;
    uid: string;
    resourceVersion?: string;
    creationTimestamp?: string;
  };
  status?: { phase?: string } & Record<string, unknown>;
  [key: string]: unknown;
}

export interface WatchEvent {
  type: WatchEventType;
  object: K8sObject;
}

export interface ResourceStore {
  /** Apply one or more watch events (ADDED/MODIFIED upsert, DELETED remove). */
  apply(event: WatchEvent | WatchEvent[]): void;
  /** Seed from an initial LIST response (replaces everything; sets the cursor). */
  reset(items: K8sObject[], resourceVersion?: string): void;
  /** Reactive current objects, sorted by namespace then name. */
  list: Accessor<K8sObject[]>;
  /** Look one up by uid. */
  get(uid: string): K8sObject | undefined;
  /** The latest resourceVersion seen — the watch resume cursor. */
  resourceVersion: Accessor<string | undefined>;
  /** Drop everything. */
  clear(): void;
}

export function createResourceStore(): ResourceStore {
  const map = new Map<string, K8sObject>();
  const version = signal<string[]>([]); // a token bumped on change to drive `list`
  const rv = signal<string | undefined>(undefined);
  let tick = 0;
  const bump = (): void => {
    version.set([String(tick++)]);
  };

  const list = computed<K8sObject[]>(() => {
    version(); // dependency
    return [...map.values()].sort((a, b) => {
      const ns = (a.metadata.namespace ?? "").localeCompare(b.metadata.namespace ?? "");
      return ns !== 0 ? ns : a.metadata.name.localeCompare(b.metadata.name);
    });
  });

  const apply = (event: WatchEvent | WatchEvent[]): void => {
    const events = Array.isArray(event) ? event : [event];
    if (events.length === 0) return;
    for (const e of events) {
      // Validate the event shape: a malformed event (no object/metadata/uid, or an
      // unknown type) must be SKIPPED, not throw and abort the whole batch. (L7)
      const uid = e?.object?.metadata?.uid;
      if (!uid || (e.type !== "DELETED" && e.type !== "ADDED" && e.type !== "MODIFIED")) continue;
      if (e.type === "DELETED") map.delete(uid);
      else map.set(uid, e.object); // ADDED or MODIFIED → upsert
      const next = e.object.metadata.resourceVersion;
      if (next) rv.set(next); // watch is ordered: the latest event's RV is the cursor
    }
    bump();
  };

  const reset = (items: K8sObject[], resourceVersion?: string): void => {
    map.clear();
    for (const o of items) map.set(o.metadata.uid, o);
    rv.set(resourceVersion);
    bump();
  };

  return {
    apply,
    reset,
    list: () => list(),
    get: (uid) => map.get(uid),
    resourceVersion: () => rv(),
    clear: () => {
      map.clear();
      rv.set(undefined);
      bump();
    },
  };
}

export interface ResourceExplorerOptions {
  store: ResourceStore;
  title?: string;
  /** Override the default columns (Name / Namespace / Kind / Status). */
  columns?: Column<K8sObject>[];
  pageSize?: number;
}

const DEFAULT_COLUMNS: Column<K8sObject>[] = [
  { key: "name", label: "Name", sortable: true, value: (r) => r.metadata.name },
  { key: "namespace", label: "Namespace", sortable: true, value: (r) => r.metadata.namespace ?? "—" },
  { key: "kind", label: "Kind", sortable: true, value: (r) => r.kind ?? "—" },
  { key: "status", label: "Status", sortable: true, value: (r) => r.status?.phase ?? "—" },
];

/** A live resource explorer: dataTable over the store, updating as events arrive. */
export function resourceExplorer(options: ResourceExplorerOptions): TemplateResult {
  return dataTable<K8sObject>({
    title: options.title ?? "Resources",
    columns: options.columns ?? DEFAULT_COLUMNS,
    rows: () => options.store.list(),
    rowKey: (r) => r.metadata.uid,
    pageSize: options.pageSize,
  });
}
