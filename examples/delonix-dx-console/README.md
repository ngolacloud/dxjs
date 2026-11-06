# delonix-dx-console — proof of concept

The **delonix-console** dashboard + containers interfaces, rebuilt on **dxjs** to
prove the React-parity stack end to end. It talks to a self-contained mock of the
delonix-paas tenant API (no network) and runs under the **same strict CSP** as
every dxjs proof (`default-src 'none'; script-src 'self'; style-src 'self'` — no
eval, no inline styles).

## Run it in the browser

```sh
# from the dxjs repo root:
node examples/delonix-dx-console/build.mjs
node examples/delonix-dx-console/serve.mjs      # → http://127.0.0.1:8080
```

Open the printed URL. (Automated proof: `node examples/delonix-dx-console/build.mjs
&& DXJS_PW_CHANNEL=chrome node --test examples/delonix-dx-console/test/console.test.mjs`.)

## What it exercises — every parity package at once

| Package | Where in the POC |
|---|---|
| `@dxjs/ui` | the `appShell` (sidebar + top bar), `dataTable`, `card`, `pill` |
| `@dxjs/charts` | the dashboard “Containers by status” doughnut (Chart.js, CSP-safe) |
| **`@dxjs/query`** | the container list + KPI reads — cached, deduped; **invalidated after a lifecycle action** so the table refreshes |
| **`@dxjs/forms`** | the “Deploy container” form (validated; disabled submit until valid) |
| **`virtualList`** (`@dxjs/ui`) | the Logs panel — thousands of lines, a handful of DOM nodes |
| **`createContext`/`provide`/`inject`** (`@dxjs/core`) | the scoped api client + tenant, provided at the app root ([src/ctx.ts](src/ctx.ts)) |
| **`onError`** (`@dxjs/core`) | a page-level error boundary in the shell ([src/app.ts](src/app.ts)) |

## Faithful to the original

The container domain ([src/compute.ts](src/compute.ts)) is ported from the React
app's `src/domains/compute`: the five statuses + `unknown`, the status→tone map,
`cpuPercent` (a stopped container is `—`, not “0 %”), `memLimit: 0` ⇒ `∞`, and the
exact **availableActions** rule (running → stop/restart/pause/rm; paused → unpause/
rm; exited|created → start/rm; dead → rm). The containers list filters (tabs + text)
are client-side over the loaded page, exactly as the console states.

## Notes found building it (fed back upstream)

- **Core fix:** a top-level reactive child binding (`html\`…${() => …}\``) went stale
  after `mount()` moved the component's nodes out of the template fragment into the
  host. Fixed in `@dxjs/dom` (`bindChild` now inserts relative to the anchor's live
  parent); regression test in `@dxjs/component`.
- **dataTable + mutable rows:** a keyed list reuses a row with an unchanged key
  *without* re-rendering it, so after an action the status/cpu cells would go stale.
  The POC versions the row key with the mutable fields (`id:status:cpu:mem`). A
  future dataTable could offer cell-level reactivity instead.
- **Idiom:** render `dataTable`/`statGrid` **unconditionally** and let their inner
  bindings fill in when the query resolves — don't wrap them in
  `${() => isLoading() ? … : …}`.
