// AUDIT PoC — L8: keyOf must not collapse a `__proto__`-named key. The old impl
//   rebuilt plain objects with `o[k] = v[k]`; for k === "__proto__" that hit the
//   prototype setter and vanished, so keys differing only in `__proto__` shared one
//   cache key — a cross-key cache collision. Asserts DISTINCT keys (red pre-fix).
import { test } from "node:test";
import assert from "node:assert/strict";
import { keyOf } from "../src/index.ts";

// JSON.parse creates an OWN `__proto__` data property (unlike the `{__proto__:…}`
// literal, which sets the prototype) — the realistic shape of a key built from input.
const withProto = (v: string): Record<string, unknown> =>
  JSON.parse(`{"__proto__":${JSON.stringify(v)},"x":1}`) as Record<string, unknown>;

test("L8: keys differing only in a __proto__ property do not collide", () => {
  const a = keyOf([withProto("a")]);
  const b = keyOf([withProto("b")]);
  const none = keyOf([{ x: 1 }]);
  assert.notEqual(a, b, "__proto__:a and __proto__:b must be distinct cache keys");
  assert.notEqual(a, none, "a key WITH __proto__ must differ from one without");
  assert.ok(a.includes("__proto__"), `the __proto__ key is preserved — got: ${a}`);
});

test("L8: ordinary determinism is unchanged (sorted keys)", () => {
  assert.equal(keyOf("todos"), "todos");
  assert.equal(keyOf(["todos", 1]), '["todos",1]');
  assert.equal(keyOf([{ b: 2, a: 1 }]), keyOf([{ a: 1, b: 2 }]));
});

test("L8: a plain object must NOT collide with an array-of-pairs", () => {
  // A bare pair-array serialisation aliased `[{a:1}]` with `[[["a",1]]]`; the
  // `{o:…}` wrapper keeps objects (braces) distinct from arrays (brackets).
  assert.notEqual(keyOf([{ a: 1 }]), keyOf([[["a", 1]]]), "object vs array-of-pairs must differ");
  assert.notEqual(keyOf([{ a: 1, b: 2 }]), keyOf([[["a", 1], ["b", 2]]]));
  // Nested objects stay deterministic and order-independent.
  assert.equal(keyOf([{ a: { y: 2, x: 1 } }]), keyOf([{ a: { x: 1, y: 2 } }]));
});
