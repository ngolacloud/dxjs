// @dxjs/edge/edge — a runtime-agnostic HTTP handler built on the Web fetch
// standard (Request -> Response). It runs unchanged on Cloudflare Workers,
// Deno and Node (via `nodeListener`). SSR is injectable: the caller renders
// the HTML (e.g. with @dxjs/server) and passes it to `htmlResponse` — this
// package never imports a renderer, keeping the edge layer dependency-light
// and decoupled from the server package.
//
// See ../../../DESIGN.md (§8).

import type { IncomingMessage, ServerResponse } from "node:http";

/** A Web-fetch route handler: takes a Request, returns a Response. */
export type EdgeHandler = (req: Request) => Response | Promise<Response>;

/** The handler produced by `createEdgeHandler`. */
export type FetchHandler = (request: Request) => Promise<Response>;

/** A map of URL pathname -> route handler. */
export type Routes = Record<string, EdgeHandler>;

export interface HtmlResponseOptions {
  status?: number;
  /** When set, emitted verbatim as the `Content-Security-Policy` header. */
  csp?: string;
  /** Extra headers merged on top of the defaults. */
  headers?: HeadersInit;
}

/**
 * Build an HTML `Response` with `content-type: text/html; charset=utf-8` and,
 * when `csp` is given, a strict `Content-Security-Policy` header. The HTML is
 * already-rendered markup supplied by the caller (injectable SSR).
 */
export function htmlResponse(html: string, options: HtmlResponseOptions = {}): Response {
  const headers = new Headers(options.headers);
  headers.set("content-type", "text/html; charset=utf-8");
  // Safe-by-default hardening headers (L2); caller-supplied values win (has-guard).
  if (!headers.has("x-content-type-options")) headers.set("x-content-type-options", "nosniff");
  if (!headers.has("referrer-policy")) headers.set("referrer-policy", "strict-origin-when-cross-origin");
  if (options.csp) headers.set("content-security-policy", options.csp);
  return new Response(html, { status: options.status ?? 200, headers });
}

/**
 * Create a runtime-agnostic fetch handler from a path -> handler map. Matching
 * is by exact `URL.pathname`. Unknown paths resolve to a `404`.
 */
export function createEdgeHandler(routes: Routes): FetchHandler {
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const route = routes[url.pathname];
    if (!route) {
      return new Response("Not Found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    return await route(request);
  };
}

// A valid Host authority: hostname or bracketed IPv6, with an optional port. Anything
// else (CRLF, spaces, path, userinfo, empty) is a malformed/injected Host. (L10)
const HOST_RE = /^(\[[0-9a-fA-F:]+\]|[a-zA-Z0-9.-]+)(:\d{1,5})?$/;

function originFromHeaders(headers: IncomingMessage["headers"]): string {
  // Do NOT blindly trust Host — a malformed/injected value poisons the Request URL.
  // Reject anything that is not a plain authority → loopback. (L10)
  const rawHost = typeof headers.host === "string" ? headers.host : "";
  const host = HOST_RE.test(rawHost) ? rawHost : "127.0.0.1";
  // node:http has no TLS flag on the message here; default to http. A proxy
  // terminating TLS sets x-forwarded-proto — honour it ONLY if it is exactly
  // `http`/`https` (reject arrays, lists and injected values). (L10)
  const xfp = headers["x-forwarded-proto"];
  const proto = xfp === "https" || xfp === "http" ? xfp : "http";
  return `${proto}://${host}`;
}

function toWebRequest(message: IncomingMessage, body: Uint8Array): Request {
  const origin = originFromHeaders(message.headers);
  const url = origin + (message.url ?? "/");

  const headers = new Headers();
  for (const [key, value] of Object.entries(message.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const method = message.method ?? "GET";
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD" && body.byteLength > 0) {
    // A Uint8Array is a valid fetch body at runtime; the cast only bridges the
    // TS 5.7 Uint8Array<ArrayBufferLike> vs lib.dom BodyInit generic mismatch.
    init.body = body as BodyInit;
  }
  return new Request(url, init);
}

/**
 * Adapt a Web-fetch handler to a Node `http.createServer` request listener:
 * it assembles a Web `Request` from the IncomingMessage and streams the
 * resulting `Response` back to the ServerResponse.
 */
export function nodeListener(
  handler: FetchHandler,
): (req: IncomingMessage, res: ServerResponse) => void {
  return function listener(req: IncomingMessage, res: ServerResponse): void {
    const chunks: Uint8Array[] = [];
    req.on("data", (chunk: Uint8Array) => chunks.push(chunk));
    req.on("error", () => {
      res.statusCode = 400;
      res.end();
    });
    req.on("end", () => {
      const body = chunks.length ? Buffer.concat(chunks) : new Uint8Array(0);
      const request = toWebRequest(req, body);
      handler(request)
        .then(async (response) => {
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          const buffer = Buffer.from(await response.arrayBuffer());
          res.end(buffer);
        })
        .catch(() => {
          if (!res.headersSent) res.statusCode = 500;
          res.end();
        });
    });
  };
}
