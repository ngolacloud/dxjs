# Seiva Console Admin — on dxjs

A faithful reproduction of the Delonix **Seiva "Console Admin"**
(`seiva/crates/seiva-console-admin`) built entirely with dxjs. It is the
worked proof that dxjs is **CSP-clean enough to live inside Seiva's strict admin
Content-Security-Policy** — the setting that disqualified StillJS (which needs
`eval`/remote `@latest` and is DOM-XSS-prone).

## What it does

On load it reads two **same-origin** endpoints and renders an admin UI from them
— exactly like the real console's inlined `ADMIN_JS`:

- `GET /admin/registry.json` — the auth-filtered list of resources the caller
  may administer. Shape: `{ resources: [{ namespace, resource, label, facade,
  version, path, list_fields, search_fields, filters, ordering, page_size,
  can: { view, create, change, delete } }] }`. The **bearer token rides on this
  fetch** (the server filters by the caller's `Principal`; anonymous ⇒ nothing).
- `GET /openapi.json` — the OpenAPI 3.1 contract (public). Operations are grouped
  by the path shape `/{version}/{resource}`.

For each resource it classifies the operations into CRUD roles and renders:

- a **data table** (list + create + per-row affordances) when the resource has a
  `list` op and `can.view`; or
- **operation forms** otherwise.

The `can.*` flags only hide affordances the caller lacks — they are **not** a
security boundary. Seiva's backend enforces every operation server-side via the
module's `#[seiva::controller]`; this UI mirrors that stance and does no client
authorization.

## Files

| File | Role |
|------|------|
| `src/contract.ts` | Pure, DOM-free port of `ADMIN_JS`: `opsForResource`, `classifyOps`, `bodyFields`. The unit-test core. |
| `src/api.ts` | Thin wrapper over `@dxjs/transport` `createClient`: `loadRegistry(client, token)`, `loadSpec(client)`, `callOp(client, method, path, body?, token)`. |
| `src/console.ts` | The `SeivaConsole` dxjs component (`@dxjs/component` + `@dxjs/dom`). |
| `src/index.ts` | Public exports + `mountConsole(host, { baseUrl })`. |

## Pointing it at a real Seiva

```ts
import { mountConsole } from "./src/index.ts";

// Same-origin (served under /admin by Seiva): baseUrl "".
// Cross-origin dev: baseUrl "https://your-seiva-host".
mountConsole(document.getElementById("app")!, { baseUrl: "" });
```

Then **paste a bearer token** into the token field at the top: its `change`
reloads the console so the resources you are authorized to see appear. The token
is sent **only** in the `Authorization` header, never in a URL.

## Why it fits Seiva's strict admin CSP

The real console serves itself under (`admin_csp()` in `lib.rs`):

```
default-src 'none'; script-src 'sha256-…'; style-src 'sha256-…';
connect-src 'self'; img-src 'self' data:; base-uri 'none';
form-action 'none'; frame-ancestors 'none'
```

No `unsafe-inline`. dxjs fits because it uses **safe sinks only**:

- values go to the DOM through `textContent` / `setAttribute` (auto-escaped) —
  **never** `.innerHTML = data`;
- events are bound with `addEventListener` — **never** inline `on*=` attributes;
- there is **no** `eval`, no `new Function`, no `document.write`, no remote
  script.

The XSS test (`test/console.test.ts`) proves it: a row whose value is
`<img onerror=… src=x>` renders as inert **text** — no `<img>` element is ever
created and the handler never runs. (StillJS, by contrast, renders via `eval`
and would execute it.)

## Tests

```sh
node --test examples/seiva-console/test/*.test.ts
```

- `contract.test.ts` — no DOM: feeds a crafted OpenAPI spec and asserts
  `classifyOps` picks list/get/create/update/delete, and `bodyFields` extracts
  request-body property names.
- `console.test.ts` — happy-dom (imports `../../../packages/dom/test/setup.ts`):
  mounts `SeivaConsole` with a `createClient` whose `fetch` is a mock returning a
  fake registry (one resource, `list` op, `can.view`/`can.create`) and a fake
  spec; asserts the table + label + create form render, that the XSS value is
  text (no element injected), and that the bearer rides in the `Authorization`
  header of the registry fetch.

## Out of scope for the unit tests

**Live integration** against a running Seiva needs the `admin-e2e` composition
root up (`cargo run` on the Seiva side, which opts the console in via
`seiva_console_admin::mount` and serves `/admin` + `/admin/registry.json` +
`/openapi.json` under `admin_csp()`). Driving that end-to-end — and the real
browser CSP proof (Playwright) — is deliberately left out here; these tests
verify the binding/escape/classification semantics against a standards DOM.

This example also trims a few of the real console's table refinements
(server-side search box, clickable column ordering, prev/next pagination,
per-row inline edit/delete). The classification + safe-render + auth-header
contract — the parts that matter for the CSP/XSS proof — are reproduced in full.
