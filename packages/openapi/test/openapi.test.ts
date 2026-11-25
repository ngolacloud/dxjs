import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot } from "@dxjs/core";
import { createForm } from "@dxjs/forms";
import { inMemoryAdapter } from "@dxjs/transport";
import { openapi, openapiClient, type OpenApiDocument } from "../src/index.ts";

const doc: OpenApiDocument = {
  openapi: "3.0.0",
  paths: {
    "/users/{id}": {
      get: {
        operationId: "getUser",
        tags: ["users"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "integer" } }],
      },
    },
    "/users": {
      get: {
        operationId: "listUsers",
        tags: ["users"],
        parameters: [
          { name: "q", in: "query", schema: { type: "string" } },
          { name: "page", in: "query", required: true, schema: { type: "integer" } },
        ],
      },
      post: {
        operationId: "createUser",
        tags: ["users"],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/NewUser" } } } },
      },
    },
  },
  components: {
    schemas: {
      NewUser: {
        type: "object",
        required: ["email", "name"],
        properties: {
          email: { type: "string", format: "email" },
          name: { type: "string", minLength: 2 },
          age: { type: "integer", minimum: 0 },
        },
      },
    },
  },
};

test("openapi() maps operations to descriptors (verb, path, idempotency, path params)", () => {
  const { method } = openapi(doc);

  const get = method("getUser");
  assert.equal((get.wire!.http as { method: string }).method, "GET");
  assert.equal(get.idempotent, true);
  const pathFn = (get.wire!.http as { path: (r: unknown) => string }).path;
  assert.equal(typeof pathFn, "function");
  assert.equal(pathFn({ id: 7 }), "/users/7");

  const create = method("createUser");
  assert.equal((create.wire!.http as { method: string }).method, "POST");
  assert.equal(create.idempotent, false);
  assert.equal((create.wire!.http as { path: string }).path, "/users");
  assert.equal((create.wire!.http as { query: boolean }).query, false);

  const list = method("listUsers");
  assert.equal((list.wire!.http as { query: boolean }).query, true, "GET sends the request as query");
});

test("validator() from a $ref body schema enforces required/type/format/length/range", () => {
  const { validator } = openapi(doc);
  const v = validator("createUser");

  assert.deepEqual(v({ email: "ana@ngola.ao", name: "Ana", age: 30 }), {}, "valid payload → no errors");
  assert.deepEqual(v({}), { email: "is required", name: "is required" });
  assert.equal(v({ email: "nope", name: "Ana" }).email, "must be a valid email");
  assert.equal(v({ email: "a@b.co", name: "A" }).name, "must be at least 2 characters");
  assert.equal(v({ email: "a@b.co", name: "Ana", age: -1 }).age, "must be ≥ 0");
});

test("validator() from parameters enforces required query params", () => {
  const { validator } = openapi(doc);
  const v = validator("listUsers");
  assert.deepEqual(v({ q: "x" }), { page: "is required" });
  assert.deepEqual(v({ page: 1 }), {});
});

test("synthesizes an operationId when absent", () => {
  const { methods } = openapi({ paths: { "/health/live": { get: {} } } });
  assert.ok(methods["getHealthLive"], "verb + PascalCase path segments");
});

test("openapiClient runs over an adapter (inMemory), keyed by operationId", async () => {
  const api = openapiClient(
    doc,
    inMemoryAdapter({ handlers: { getUser: (req: { id: number }) => ({ id: req.id, name: "Ana" }) } }),
  );
  assert.deepEqual(await api.call("getUser", { id: 7 }), { id: 7, name: "Ana" });
});

test("the generated validator plugs straight into @dxjs/forms createForm", () => {
  createRoot((dispose) => {
    const { validator } = openapi(doc);
    const f = createForm<{ email: string; name: string }>({
      initial: { email: "", name: "" },
      validate: validator("createUser") as (v: { email: string; name: string }) => Record<string, string>,
    });
    assert.equal(f.isValid(), false, "required fields empty → invalid");
    assert.equal(f.error("email")(), "is required");
    f.field("email").onInput(evt("ana@ngola.ao"));
    f.field("name").onInput(evt("Ana"));
    assert.equal(f.isValid(), true, "valid once filled");
    dispose();
  });
});

// Minimal input-event stub for forms field.onInput.
function evt(value: string): Event {
  return { target: { value } } as unknown as Event;
}
