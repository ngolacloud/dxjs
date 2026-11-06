// Pure classification logic for the Seiva admin console — a faithful port of the
// `ADMIN_JS` functions in
// seiva/crates/seiva-console-admin/src/lib.rs (opsForResource / classifyOps /
// bodyFields). No DOM, no network: these are the unit-test core. The console UI
// (console.ts) renders from exactly what these return.

/** A JSON Schema fragment (the subset the console inspects). */
export interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchema>;
}

/** One OpenAPI operation object (only the fields the console reads). */
export interface Operation {
  requestBody?: { content?: Record<string, { schema?: JsonSchema }> };
  /** Seiva records the required permission here (presentational only). */
  requires?: string;
  "x-seiva-requires"?: string;
  [extra: string]: unknown;
}

/** A path item: the operations keyed by HTTP method. */
export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  patch?: Operation;
  delete?: Operation;
}

/** An OpenAPI 3.1 document (only `paths` is read). */
export interface OpenApiSpec {
  paths?: Record<string, PathItem>;
  [extra: string]: unknown;
}

/** An operation tagged with the method and URL it was found under. */
export interface ClassifiedOp {
  method: string;
  path: string;
  op: Operation;
}

/** The CRUD roles a resource's operations fall into. */
export interface Classified {
  list?: ClassifiedOp;
  get?: ClassifiedOp;
  create?: ClassifiedOp;
  update?: ClassifiedOp;
  delete?: ClassifiedOp;
}

// The HTTP methods the console considers, in the same order as ADMIN_JS.
const METHODS = ["get", "post", "put", "patch", "delete"] as const;

/**
 * Operations whose resource segment (`/{version}/{resource}`) matches
 * `resource` — the console shows ONLY these. Mirrors ADMIN_JS `opsForResource`:
 * the resource is the second non-empty path segment, falling back to the first.
 */
export function opsForResource(spec: OpenApiSpec, resource: string): ClassifiedOp[] {
  const out: ClassifiedOp[] = [];
  const paths = spec.paths ?? {};
  for (const path of Object.keys(paths)) {
    const item = paths[path] as PathItem;
    const seg = path.split("/").filter(Boolean);
    const res = seg[1] ?? seg[0];
    if (res !== resource) continue;
    for (const method of METHODS) {
      const op = item[method];
      if (!op) continue;
      out.push({ method, path, op });
    }
  }
  return out;
}

/**
 * Classify a resource's operations by CRUD role from the contract's path shape,
 * mirroring ADMIN_JS `classifyOps`:
 *   - list   = GET /{ver}/{res}         (no `{param}`)
 *   - get    = GET with a `{param}`
 *   - update = POST .../update
 *   - delete = POST .../delete
 *   - create = any other POST /{ver}/{res}
 */
export function classifyOps(spec: OpenApiSpec, resource: string): Classified {
  const k: Classified = {};
  for (const o of opsForResource(spec, resource)) {
    const param = o.path.includes("{");
    if (o.method === "get" && !param) k.list = o;
    else if (o.method === "get" && param) k.get = o;
    else if (o.method === "post" && /\/update$/.test(o.path)) k.update = o;
    else if (o.method === "post" && /\/delete$/.test(o.path)) k.delete = o;
    else if (o.method === "post") k.create = o;
  }
  return k;
}

/**
 * The request-body field names for an operation (from its JSON schema),
 * mirroring ADMIN_JS `bodyFields`.
 */
export function bodyFields(op: Operation): string[] {
  const schema = op.requestBody?.content?.["application/json"]?.schema ?? {};
  return Object.keys(schema.properties ?? {});
}
