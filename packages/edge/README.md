# @dxjs/edge

Edge/server glue for dxjs: a runtime-agnostic HTTP handler and a native gRPC
unary client. Both are built on Web standards and `node:http2` — no bundler
magic, no browser-only assumptions.

## Edge handlers (`edge.ts`)

`createEdgeHandler(routes)` returns a `(request: Request) => Promise<Response>`
built on the Web **fetch** standard. The same handler runs unchanged on
Cloudflare Workers, Deno, and Node:

```ts
import { createEdgeHandler, htmlResponse, nodeListener } from "@dxjs/edge";
import { createServer } from "node:http";

// SSR is INJECTABLE — render your HTML however you like (e.g. @dxjs/server)
// and hand the finished markup to htmlResponse. @dxjs/edge never imports a
// renderer, so the edge layer stays decoupled from the server package.
const handler = createEdgeHandler({
  "/": (_req) =>
    htmlResponse("<!doctype html><title>hi</title><h1>dxjs</h1>", {
      csp: "default-src 'self'",
    }),
});

// On Workers/Deno: export default { fetch: handler }.
// On Node: adapt to http.createServer:
createServer(nodeListener(handler)).listen(8080);
```

- `htmlResponse(html, { status?, csp?, headers? })` — a `text/html` Response with
  an optional strict `Content-Security-Policy` header.
- Unknown paths resolve to `404`.
- `nodeListener(handler)` bridges a Web-fetch handler to a Node
  `http.createServer` request listener.

## Native gRPC (`grpc.ts`)

`createGrpcChannel({ url })` speaks **real gRPC** over `node:http2`: a
length-prefixed frame (1-byte compression flag + 4-byte big-endian length +
payload), `content-type: application/grpc+proto`, `te: trailers`, and — the key
part — it reads the `grpc-status` / `grpc-message` **HTTP/2 trailers**. A
non-zero status rejects with an `Error` carrying `.code` (numeric) and
`.details`.

```ts
import { createGrpcChannel } from "@dxjs/edge";

const channel = createGrpcChannel({ url: "http://127.0.0.1:50051" });
// Payloads are OPAQUE bytes — bring your own protobuf/JSON encoder.
const reply = await channel.unary("my.Service", "Method", requestBytes, {
  deadlineMs: 5000,
});
```

### Why not in the browser?

Browsers **cannot** read HTTP/2 trailers from `fetch`, so native gRPC is
impossible there. In the browser, dxjs speaks **Connect** instead — see
[`@dxjs/transport`](../transport) (`createConnectClient`), a plain POST to
`/{service}/{method}` understood by a Connect-enabled backend. Use native gRPC
only on a server/edge runtime co-located with the gRPC backend.
