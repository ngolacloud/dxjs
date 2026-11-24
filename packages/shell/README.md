# @dxjs/shell

Cloud Shell interaction primitives, all CSP-safe (classes + @event listeners,
escaped text — no eval, no inline handlers).

- **Command palette** — `createCommandPalette(commands)`: substring filter over
  title+keywords, clamped keyboard navigation, run-the-active-command.
- **Idempotent toasts** — `createToaster()`: `notify({key,level,text})` updates in
  place when the key already exists (no duplicate), so a retrying operation is
  safe to call repeatedly.
- **Topology** — `topologyGraph(services, links)`: builds a `@dxjs/canvas` reactive
  graph (grid layout, one edge per link; invalid links skipped) you render with
  canvas's `draw`.

```ts
import { createCommandPalette, createToaster, topologyGraph } from "@dxjs/shell";

const palette = createCommandPalette([
  { id: "logs", title: "Open logs", keywords: "tail", run: () => go("/logs") },
]);
// wire ⌘K to palette.toggle(); render palette.view()

const toaster = createToaster();
toaster.notify({ key: "deploy", level: "info", text: "Deploying…" });
toaster.notify({ key: "deploy", level: "success", text: "Deployed" }); // updates, no dupe

const g = topologyGraph(
  [{ id: "web", label: "web" }, { id: "db", label: "db" }],
  [{ from: "web", to: "db" }],
);
```
