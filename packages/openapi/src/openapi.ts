// @dxjs/openapi/openapi — parse an OpenAPI 3 document into Transport
// MethodDescriptors + @dxjs/forms validators, at runtime (ADR 0001 §7). No code
// emission, no eval — the app reads openapi.json and gets a typed, validated client
// over any adapter (the same shape the Seiva admin console already consumes).

import { method, type MethodDescriptor, type Transport, type CallCtx } from "@dxjs/transport";
import { compileValidator, type JsonSchema, type SchemaValidator, type Resolver } from "./schema.ts";

export interface OpenApiDocument {
  openapi?: string;
  paths?: Record<string, Record<string, unknown>>;
  components?: { schemas?: Record<string, JsonSchema> };
}

interface Operation {
  operationId?: string;
  tags?: string[];
  parameters?: Array<{ name: string; in: string; required?: boolean; schema?: JsonSchema }>;
  requestBody?: { content?: Record<string, { schema?: JsonSchema }> };
}

const VERBS = ["get", "post", "put", "patch", "delete", "head", "options"] as const;
const IDEMPOTENT = new Set<string>(["get", "head", "put", "delete", "options"]);
const BODY_VERBS = new Set<string>(["post", "put", "patch"]);

function makeResolver(doc: OpenApiDocument): Resolver {
  const schemas = doc.components?.schemas ?? {};
  return (ref) => {
    const m = /^#\/components\/schemas\/(.+)$/.exec(ref);
    return m ? schemas[m[1]!] : undefined;
  };
}

/** operationId, or a synthesized "<verb><PathSegments>" fallback. */
function operationId(verb: string, path: string, op: Operation): string {
  if (op.operationId) return op.operationId;
  const seg = path
    .replace(/[{}]/g, "")
    .split("/")
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  return verb + seg;
}

/** A literal path, or a function that substitutes {params} from the request. */
function pathValue(template: string): string | ((req: unknown) => string) {
  if (!template.includes("{")) return template;
  return (req) =>
    template.replace(/\{(\w+)\}/g, (_, k: string) =>
      encodeURIComponent(String((req as Record<string, unknown> | undefined)?.[k] ?? "")),
    );
}

function bodySchema(op: Operation): JsonSchema | undefined {
  const content = op.requestBody?.content;
  if (!content) return undefined;
  return content["application/json"]?.schema ?? Object.values(content)[0]?.schema;
}

/** Build an object schema from required/typed query+path parameters. */
function paramSchema(op: Operation): JsonSchema | undefined {
  const params = (op.parameters ?? []).filter((p) => p.in === "query" || p.in === "path");
  if (!params.length) return undefined;
  const properties: Record<string, JsonSchema> = {};
  const required: string[] = [];
  for (const p of params) {
    properties[p.name] = p.schema ?? { type: "string" };
    if (p.required) required.push(p.name);
  }
  return { type: "object", properties, required };
}

export interface OpenApiResult {
  /** Descriptors keyed by operationId. */
  methods: Record<string, MethodDescriptor>;
  /** The descriptor for an operation (throws if unknown). */
  method(id: string): MethodDescriptor;
  /** A @dxjs/forms validator for an operation's request (empty if none). */
  validator(id: string): SchemaValidator;
}

/** Parse an OpenAPI 3 document into descriptors + validators. */
export function openapi(doc: OpenApiDocument): OpenApiResult {
  const resolve = makeResolver(doc);
  const methods: Record<string, MethodDescriptor> = {};
  const validators: Record<string, SchemaValidator> = {};

  for (const [path, item] of Object.entries(doc.paths ?? {})) {
    for (const verb of VERBS) {
      const op = (item as Record<string, Operation | undefined>)[verb];
      if (!op || typeof op !== "object") continue;
      const id = operationId(verb, path, op);
      const service = op.tags?.[0] ?? path.split("/").filter(Boolean)[0] ?? "api";
      const hasBody = BODY_VERBS.has(verb);
      methods[id] = method({
        id,
        service,
        method: id,
        wire: { http: { method: verb.toUpperCase(), path: pathValue(path), query: !hasBody } },
        idempotent: IDEMPOTENT.has(verb),
      });
      const schema = (hasBody ? bodySchema(op) : undefined) ?? paramSchema(op);
      validators[id] = schema ? compileValidator(schema, resolve) : () => ({});
    }
  }

  return {
    methods,
    method(id) {
      const m = methods[id];
      if (!m) throw new Error(`openapi: no operation "${id}"`);
      return m;
    },
    validator: (id) => validators[id] ?? (() => ({})),
  };
}

export interface OpenApiClient extends OpenApiResult {
  /** Call an operation by id over the bound transport. */
  call<Res = unknown, Req = unknown>(id: string, req?: Req, ctx?: CallCtx): Promise<Res>;
}

/** Bind an OpenAPI document to a transport → a typed, validated client over any adapter. */
export function openapiClient(doc: OpenApiDocument, transport: Transport): OpenApiClient {
  const r = openapi(doc);
  return {
    ...r,
    // Descriptors in the map are MethodDescriptor<unknown,unknown>; the caller names
    // Res/Req, so bridge the dynamic lookup to the declared return type.
    call: <Res = unknown, Req = unknown>(id: string, req?: Req, ctx?: CallCtx): Promise<Res> =>
      transport.unary(r.method(id), req, ctx) as Promise<Res>,
  };
}
