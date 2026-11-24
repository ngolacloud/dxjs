# @dxjs/k8s

A Kubernetes resource explorer. A **watch store** applies ADDED/MODIFIED/DELETED
events to a live, uid-keyed collection and tracks the latest `resourceVersion` as
the **resume cursor**; an **explorer** renders it with `@dxjs/ui` dataTable
(sort/search/paginate), updating live as events arrive.

```ts
import { createResourceStore, resourceExplorer } from "@dxjs/k8s";

const store = createResourceStore();
store.reset(initialListItems, listResourceVersion);   // from the LIST response

// Feed watch events from any stream (e.g. a @dxjs/transport LiveSource topic):
store.apply({ type: "ADDED",    object: pod });
store.apply({ type: "MODIFIED", object: podWithNewStatus });
store.apply({ type: "DELETED",  object: pod });

store.resourceVersion();   // → cursor to resume a dropped watch (?resourceVersion=…)

render(() => resourceExplorer({ store, title: "Pods" }), host);
```

Transport-agnostic (you call `apply()`), escaped output, classes only → strict-CSP
safe. On a watch drop, reconnect with the stored `resourceVersion` so no event is
missed or replayed.
