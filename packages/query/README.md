# @dxjs/query

Cached, deduped, **stale-while-revalidate** async queries for dxjs — the
signal-reactive answer to react-query, with key-based invalidation. Fetcher-agnostic
(any `() => Promise`); no eval; built on `@dxjs/core`.

```ts
import { createQueryClient, query } from "@dxjs/query";

const client = createQueryClient();

// inside a component:
const todos = query(client, ["todos"], () => api.get("/todos"), { staleTime: 5000 });
todos.data();        // the value (reactive)
todos.isLoading();   // first load
todos.isFetching();  // any in-flight fetch
todos.refetch();

client.invalidate(["todos"]);         // refetch live observers (prefix match)
client.setData(["todos"], optimistic); // optimistic update
```

- **Dedupe:** concurrent `query()` for one key share a single in-flight request.
- **Cache + SWR:** cached data shows immediately while a background refetch runs.
- **Invalidate by prefix:** `invalidate(["todos"])` also matches `["todos", 1]`.
