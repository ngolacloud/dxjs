// AUDIT PoC — L3: a malformed percent-escape in a route param must not crash the
//   router. `decodeURIComponent("%E0%A4")` throws URIError; before the fix that
//   propagated out of buildLevels and brought the router down on a hostile URL.
//   Asserts the SAFE behaviour: no throw, and the param falls back to its raw value.
import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { html } from "@dxjs/dom";
import { component } from "../src/index.ts";
import { createRouter, type RouteContext } from "../src/router.ts";

const User = component<RouteContext>((c) => html`<h1>user ${c.params.id}</h1>`);
const reset = (path = "/"): void => {
  (globalThis as { history: History }).history.replaceState(null, "", path);
};

test("L3: a malformed %-escape in a param does not throw out of the router", () => {
  reset("/");
  const host = body();
  const r = createRouter([{ path: "/users/:id", component: User }]);
  r.outlet(host);
  // Pre-fix this throws URIError from decodeURIComponent inside the match.
  assert.doesNotThrow(() => r.navigate("/users/%E0%A4"));
  assert.equal(r.current()!.ctx.params.id, "%E0%A4", "param falls back to the raw segment");
  assert.equal(host.querySelector("h1")!.textContent, "user %E0%A4");
  r.dispose();
});

test("L3: a lone % is tolerated too", () => {
  reset("/");
  const host = body();
  const r = createRouter([{ path: "/users/:id", component: User }]);
  r.outlet(host);
  assert.doesNotThrow(() => r.navigate("/users/%"));
  assert.equal(r.current()!.ctx.params.id, "%");
  r.dispose();
});
