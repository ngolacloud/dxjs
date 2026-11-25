// AUDIT PoC — H2 (ALTO): ReDoS. `compileValidator` compiles schema.pattern (which
// comes from the runtime openapi.json — untrusted data) with `new RegExp` and runs
// it against user input with no anchor, length cap or timeout. A catastrophic
// pattern like ^(a+)+$ causes exponential backtracking (measured ~1.1s at 28 chars,
// ~18s at 32). This asserts the validation is BOUNDED; it fails pre-fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { compileValidator, type JsonSchema } from "../src/schema.ts";

test("H2: a malicious OpenAPI pattern must not cause catastrophic backtracking", () => {
  const schema: JsonSchema = {
    type: "object",
    properties: { x: { type: "string", pattern: "^(a+)+$" } },
  };
  const validate = compileValidator(schema);

  // 28 'a's + a non-matching tail → worst-case backtracking on the naive path
  // (~1.1s), while a bounded implementation returns in well under 100ms.
  const evil = "a".repeat(28) + "!";

  const start = process.hrtime.bigint();
  const errors = validate({ x: evil });
  const ms = Number(process.hrtime.bigint() - start) / 1e6;

  assert.ok(ms < 100, `pattern validation must be bounded — took ${ms.toFixed(0)}ms`);
  // The value does not match the (intended) pattern, so a "format" error is fine;
  // what must NOT happen is the multi-second hang. We only assert on the timing.
  assert.equal(typeof errors, "object");
});

test("H2: a normal, safe pattern still validates correctly", () => {
  const schema: JsonSchema = {
    type: "object",
    properties: { code: { type: "string", pattern: "^[A-Z]{3}$" } },
  };
  const validate = compileValidator(schema);
  assert.deepEqual(validate({ code: "AGO" }), {});
  assert.ok("code" in validate({ code: "ago" }));
});
