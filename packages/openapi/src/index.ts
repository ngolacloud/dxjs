// @dxjs/openapi — runtime OpenAPI 3 → Transport MethodDescriptors + @dxjs/forms
// validators. See ../../../docs/adr/0001-transport-port-and-adapters.md (§7).

export { openapi, openapiClient } from "./openapi.ts";
export type { OpenApiDocument, OpenApiResult, OpenApiClient } from "./openapi.ts";

export { compileValidator } from "./schema.ts";
export type { JsonSchema, JsonType, SchemaValidator, Resolver } from "./schema.ts";
