# @dxjs/logs

A virtualized, multi-source log viewer. Lines arrive from many sources, are merged
in time order, and are filtered reactively by minimum level, active sources and a
text query. Only the visible window is rendered (via `@dxjs/ui` virtualList), so a
viewer with tens of thousands of lines keeps a handful of DOM nodes.

```ts
import { createLogViewer } from "@dxjs/logs";

const logs = createLogViewer({ height: 480, rowHeight: 22 });
logs.append({ ts: Date.now(), source: "api", level: "info", text: "started" });
logs.append({ ts: Date.now(), source: "db",  level: "warn", text: "slow query" });

logs.setMinLevel("warn");          // hide debug/info
logs.setSources(["api"]);          // only this source (null = all)
logs.setQuery("slow");             // text filter

render(() => logs.view(), host);   // virtualized <div> list
```

Text goes through the safe textContent sink (escaped) and layout is classes only
→ strict-CSP safe. Feed `append()` from any stream (e.g. a @dxjs/transport
LiveSource topic).
