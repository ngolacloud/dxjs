# @dxjs/openapi

A **runtime** OpenAPI 3 profile for the [@dxjs/transport](../transport) port
(see [ADR 0001](../../docs/adr/0001-transport-port-and-adapters.md)). It turns an
`openapi.json` into:

- typed `MethodDescriptor`s (one per operation, with `wire.http` = verb + path,
  path-parameter substitution, and idempotency), and
- [@dxjs/forms](../forms)-compatible validators derived from each operation's
  request schema — so client-side validation mirrors the server contract.

No build step, no `eval`, no code emission — it parses the document at runtime and
works under a strict CSP.

```ts
import { openapiClient } from "@dxjs/openapi";
import { restAdapter } from "@dxjs/transport";

const api = openapiClient(doc, restAdapter({ baseUrl: "/v1" }));
const user = await api.call("getUser", { id: 7 });     // typed descriptor over any adapter
const validate = api.validator("createUser");          // → createForm({ validate })
```

Swap `restAdapter` for `embeddedAdapter`/`connectAdapter`/`grpcNativeAdapter` and the
same calls run over a different protocol/deployment, unchanged.
