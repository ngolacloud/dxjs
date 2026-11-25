// The console's data access, built on the @dxjs/transport PORT (ADR 0001) rather
// than a protocol-specific client. The console is handed a `Transport` (REST wrapped
// with the @dxjs/seiva error profile — see ../src/index.ts), so every call yields a
// structured SeivaError on failure and the SAME console could run over an embedded
// (in-process) adapter unchanged.
//
// Like the real console, the bearer token rides ONLY in the Authorization header
// (never in a URL): it is passed as `ctx.auth`, and the REST adapter injects it. The
// registry is auth-filtered server-side, so its call MUST carry the token;
// /openapi.json is public, so loadSpec passes none.

import { method, type Transport, type CallCtx, type MethodDescriptor } from "@dxjs/transport";
import type { OpenApiSpec } from "./contract.ts";

/** The per-operation permission flags (presentational; the server still enforces). */
export interface Can {
  view: boolean;
  create: boolean;
  change: boolean;
  delete: boolean;
}

/** One resource as the registry describes it (shape of /admin/registry.json rows). */
export interface AdminResource {
  namespace: string;
  resource: string;
  label: string;
  facade?: string;
  version?: string;
  path?: string;
  list_fields?: string[];
  search_fields?: string[];
  filters?: string[];
  ordering?: string[];
  page_size?: number;
  can?: Can;
}

/** The auth-filtered registry body. */
export interface Registry {
  resources: AdminResource[];
}

/** An ad-hoc descriptor for a `verb path` call (the console discovers paths at
 *  runtime from the registry/spec, so it builds descriptors on the fly). */
const opDescriptor = (verb: string, path: string): MethodDescriptor =>
  method({
    id: `${verb} ${path}`,
    service: "seiva",
    method: path,
    wire: { http: { method: verb.toUpperCase(), path } },
    idempotent: verb.toUpperCase() === "GET",
  });

/** Call context carrying the bearer token (only when present). */
const authCtx = (token?: string): CallCtx => {
  const t = (token ?? "").trim();
  return t ? { auth: t } : {};
};

/** GET /admin/registry.json with the bearer token (the server filters by Principal). */
export function loadRegistry(transport: Transport, token?: string): Promise<Registry> {
  return transport.unary<undefined, Registry>(opDescriptor("GET", "/admin/registry.json"), undefined, authCtx(token));
}

/** GET /openapi.json (public, same-origin) — the full service contract. */
export function loadSpec(transport: Transport): Promise<OpenApiSpec> {
  return transport.unary<undefined, OpenApiSpec>(opDescriptor("GET", "/openapi.json"), undefined);
}

/** Invoke one resource operation at `path`. Errors arrive as SeivaError (the
 *  transport carries the @dxjs/seiva interceptor). */
export function callOp(
  transport: Transport,
  verb: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<unknown> {
  return transport.unary(opDescriptor(verb, path), body, authCtx(token));
}
