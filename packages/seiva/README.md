# @dxjs/seiva

The **Seiva profile** for the [@dxjs/transport](../transport) port
(see [ADR 0001](../../docs/adr/0001-transport-port-and-adapters.md)). It carries the
guarantees of a mature Seiva backend across the boundary to the user:

- **`seivaErrors()`** — an interceptor that turns any thrown error (REST `HttpError`,
  Connect `ConnectError`, a Seiva error envelope) into a structured **`SeivaError`**:
  `kind` (validation / unauthorized / forbidden / conflict / not-found / rate-limit /
  server / network), field errors for [@dxjs/forms](../forms), `traceId`, and
  `retryable`. 401/403 map scope/BOLA; 409/412 map DORM optimistic concurrency.
- **`liveInvalidation()`** — subscribes to Seiva command-bus events over the port's
  `serverStream` and invalidates the matching [@dxjs/query](../query) keys, so the UI
  stays consistent with the backend with no polling.

Because it is built on the port, the **same app code** runs over `restAdapter`
(separate deployment) and `embeddedAdapter` (embedded, in-process) unchanged.

```ts
import { seivaErrors, liveInvalidation } from "@dxjs/seiva";
import { withInterceptors, restAdapter } from "@dxjs/transport";
import { openapiClient } from "@dxjs/openapi";

const api = openapiClient(doc, withInterceptors(restAdapter({ baseUrl: "/v1" }), seivaErrors()));
```
