// AUDIT PoC — L13: the HMR client dynamic-import()s the `path` the server sends.
//   Under strict CSP only a same-origin module loads, but the client must not
//   trust the message blindly. `isTrustedModuleUrl` accepts ONLY a same-origin
//   /@fs|/@app module URL (no scheme, no protocol-relative host, no backslash/NUL),
//   and `isValidVersion` only a finite non-negative number. applyUpdate uses both
//   before importing (full reload otherwise).
import { test } from "node:test";
import assert from "node:assert/strict";
import { isTrustedModuleUrl, isValidVersion } from "../src/hmr-guard.ts";

test("L13: isTrustedModuleUrl accepts same-origin dev module URLs only", () => {
  assert.ok(isTrustedModuleUrl("/@fs/home/app/x.ts"));
  assert.ok(isTrustedModuleUrl("/@app/widgets/x.js"));
  // Rejected: absolute URL, protocol-relative host, other path, backslash, NUL, non-string.
  for (const bad of [
    "https://evil.example/x.js",
    "//evil.example/x.js",
    "/other/x.js",
    "@fs/x.js",
    "/@fs/a\\..\\b.js",
    "/@fs/x\0.js",
    42,
    null,
    undefined,
  ]) {
    assert.ok(!isTrustedModuleUrl(bad), `must reject: ${String(bad)}`);
  }
});

test("L13: isValidVersion accepts only a finite non-negative number", () => {
  assert.ok(isValidVersion(0));
  assert.ok(isValidVersion(17));
  for (const bad of [-1, NaN, Infinity, "3", null, undefined]) {
    assert.ok(!isValidVersion(bad), `must reject: ${String(bad)}`);
  }
});
