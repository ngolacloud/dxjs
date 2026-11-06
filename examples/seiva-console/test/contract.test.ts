// Unit tests for the pure classification core — no DOM, no network.
// These assert the port matches ADMIN_JS (lib.rs) role classification.
import { test } from "node:test";
import assert from "node:assert/strict";
import { opsForResource, classifyOps, bodyFields, type OpenApiSpec } from "../src/contract.ts";

// A crafted contract for resource "widgets" under version "v1", with the full
// CRUD surface Seiva's typed CRUD controller emits, plus a decoy resource.
const spec: OpenApiSpec = {
  paths: {
    "/v1/widgets": {
      get: {}, // list  (GET, no {param})
      post: {
        // create (POST, not .../update|delete)
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { name: {}, qty: { type: "integer" } } },
            },
          },
        },
      },
    },
    "/v1/widgets/{id}": { get: {} }, // get (GET with {param})
    "/v1/widgets/update": {
      post: {
        requestBody: {
          content: {
            "application/json": {
              schema: { type: "object", properties: { id: {}, name: {}, version: {} } },
            },
          },
        },
      },
    },
    "/v1/widgets/delete": { post: {} }, // delete
    "/v1/gadgets": { get: {} }, // decoy, different resource
  },
};

test("opsForResource selects only the matching resource segment", () => {
  const ops = opsForResource(spec, "widgets");
  const paths = ops.map((o) => `${o.method} ${o.path}`).sort();
  assert.deepEqual(paths, [
    "get /v1/widgets",
    "get /v1/widgets/{id}",
    "post /v1/widgets",
    "post /v1/widgets/delete",
    "post /v1/widgets/update",
  ]);
  // The decoy resource never leaks in.
  assert.ok(!paths.some((p) => p.includes("gadgets")));
});

test("classifyOps maps each operation to the right CRUD role", () => {
  const k = classifyOps(spec, "widgets");
  assert.equal(k.list?.path, "/v1/widgets");
  assert.equal(k.list?.method, "get");
  assert.equal(k.get?.path, "/v1/widgets/{id}");
  assert.equal(k.create?.path, "/v1/widgets");
  assert.equal(k.create?.method, "post");
  assert.equal(k.update?.path, "/v1/widgets/update");
  assert.equal(k.delete?.path, "/v1/widgets/delete");
});

test("classifyOps on an unknown resource yields nothing", () => {
  const k = classifyOps(spec, "nope");
  assert.deepEqual(k, {});
});

test("bodyFields extracts request-body property names", () => {
  const k = classifyOps(spec, "widgets");
  assert.deepEqual(bodyFields(k.create!.op), ["name", "qty"]);
  assert.deepEqual(bodyFields(k.update!.op), ["id", "name", "version"]);
  // An operation with no request body → no fields.
  assert.deepEqual(bodyFields(k.list!.op), []);
});

test("a resource exposed at the top level (no version segment) still classifies", () => {
  // When a path has a single segment, res = seg[1] ?? seg[0] falls back to seg[0].
  const flat: OpenApiSpec = { paths: { "/health": { get: {} } } };
  const k = classifyOps(flat, "health");
  assert.equal(k.list?.path, "/health");
});
