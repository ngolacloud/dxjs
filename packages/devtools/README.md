# @dxjs/devtools

A signals inspector for dxjs. Installs the `@dxjs/core` inspector hook and keeps a
**live, reactive snapshot** of the reactive graph — every signal/computed/effect
created while active, with its kind, name, current value and recompute count.

```ts
import { createDevtools } from "@dxjs/devtools";
import { signal, computed, effect } from "@dxjs/core";

const dev = createDevtools();               // install BEFORE creating state
const n = signal(0, { name: "count" });
const double = computed(() => n() * 2, { name: "double" });
effect(() => double(), "log");

n.set(5);
dev.nodes();   // [{kind:"signal",name:"count",value:5,…},
               //  {kind:"computed",name:"double",value:10,runs:…}, …]
dev.stop();    // uninstall → core returns to its zero-cost path
```

Dev-only. Without devtools installed, `@dxjs/core` never allocates inspect
handles — the hot path is a single null check.
