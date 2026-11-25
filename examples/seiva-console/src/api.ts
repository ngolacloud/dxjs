// A thin wrapper over @dxjs/transport's createClient for the two same-origin
// endpoints the Seiva console reads and for invoking the resources' operations.
//
// Like the real console, the bearer token rides ONLY in the Authorization
// header (never in a URL). The registry is auth-filtered server-side, so its
// fetch MUST carry the token — otherwise the server sees an anonymous caller and
// returns nothing. /openapi.json is public, so loadSpec sends no token.

import type { Client } from "@dxjs/transport";
import { toSeivaError } from "@dxjs/seiva";
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

/** Authorization header for a call, or none when no token is present. */
function authHeaders(token?: string): Record<string, string> {
  const t = (token ?? "").trim();
  return t ? { authorization: "Bearer " + t } : {};
}

/**
 * GET /admin/registry.json with the bearer token. The server filters the list
 * by the caller's Principal, so the token must ride on THIS fetch.
 */
export function loadRegistry(client: Client, token?: string): Promise<Registry> {
  return client.get<Registry>("/admin/registry.json", { headers: authHeaders(token) }).catch((e: unknown) => {
    throw toSeivaError(e);
  });
}

/** GET /openapi.json (public, same-origin) — the full service contract. */
export function loadSpec(client: Client): Promise<OpenApiSpec> {
  return client.get<OpenApiSpec>("/openapi.json").catch((e: unknown) => {
    throw toSeivaError(e);
  });
}

/**
 * Invoke one resource operation at `path`. The bearer token (if any) is sent in
 * the Authorization header; the backend guard on the module's controller is the
 * real authority. Returns the parsed JSON body.
 */
export function callOp(
  client: Client,
  method: string,
  path: string,
  body?: unknown,
  token?: string,
): Promise<unknown> {
  // Map any failure to a structured SeivaError (kind + field errors + trace ref),
  // so the console can show the user a precise, recoverable message.
  return client.request<unknown>(method, path, body, { headers: authHeaders(token) }).catch((e: unknown) => {
    throw toSeivaError(e);
  });
}
