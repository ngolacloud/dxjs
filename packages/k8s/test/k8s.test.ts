import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { component, mount } from "@dxjs/component";
import { createResourceStore, resourceExplorer, type K8sObject, type WatchEvent } from "../src/index.ts";

const pod = (name: string, uid: string, rv: string, phase = "Running", ns = "default"): K8sObject => ({
  kind: "Pod",
  metadata: { name, uid, namespace: ns, resourceVersion: rv },
  status: { phase },
});

test("watch store: upsert on ADDED/MODIFIED, remove on DELETED, track resourceVersion", () => {
  const store = createResourceStore();
  store.apply({ type: "ADDED", object: pod("a", "u1", "10") });
  store.apply({ type: "ADDED", object: pod("b", "u2", "11") });
  assert.deepEqual(store.list().map((p) => p.metadata.name), ["a", "b"]);
  assert.equal(store.resourceVersion(), "11", "cursor is the latest event's RV");

  // MODIFIED upserts in place (same uid), updates status.
  store.apply({ type: "MODIFIED", object: pod("a", "u1", "12", "Failed") });
  assert.equal(store.get("u1")!.status!.phase, "Failed");
  assert.equal(store.list().length, 2, "modify does not duplicate");
  assert.equal(store.resourceVersion(), "12");

  // DELETED removes.
  store.apply({ type: "DELETED", object: pod("b", "u2", "13") });
  assert.deepEqual(store.list().map((p) => p.metadata.name), ["a"]);
  assert.equal(store.resourceVersion(), "13");
});

test("reset() seeds from an initial LIST and sorts by namespace then name", () => {
  const store = createResourceStore();
  store.reset(
    [pod("z", "u1", "1", "Running", "kube-system"), pod("a", "u2", "1", "Running", "default"), pod("b", "u3", "1", "Running", "default")],
    "100",
  );
  assert.deepEqual(
    store.list().map((p) => `${p.metadata.namespace}/${p.metadata.name}`),
    ["default/a", "default/b", "kube-system/z"],
  );
  assert.equal(store.resourceVersion(), "100");
});

test("explorer renders resources and updates LIVE on watch events", () => {
  const host = body();
  const store = createResourceStore();
  store.reset([pod("web-1", "u1", "5")], "5");

  const App = component(() => resourceExplorer({ store, title: "Pods", pageSize: 50 }));
  mount(App, host, {});

  const names = () => [...host.querySelectorAll("tbody tr td:first-child")].map((td) => td.textContent);
  assert.deepEqual(names(), ["web-1"], "initial resource rendered");

  // A new pod appears live.
  store.apply({ type: "ADDED", object: pod("web-2", "u2", "6") });
  assert.deepEqual(names(), ["web-1", "web-2"], "ADDED row appeared");

  // Deleting one removes its row live.
  store.apply({ type: "DELETED", object: pod("web-1", "u1", "7") });
  assert.deepEqual(names(), ["web-2"], "DELETED row removed");
});
