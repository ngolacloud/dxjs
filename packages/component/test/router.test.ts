import { body, popstate } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { html } from "@dxjs/dom";
import { component, onMount } from "../src/index.ts";
import { createRouter, type RouteContext } from "../src/router.ts";

const Home = component<RouteContext>(() => html`<h1>home</h1>`);
const User = component<RouteContext>((c) => html`<h1>user ${c.params.id}</h1>`);

function reset(path = "/") {
  (globalThis as { history: History }).history.replaceState(null, "", path);
}

test("matches a route and mounts it in the outlet", () => {
  reset("/");
  const host = body();
  const r = createRouter([
    { path: "/", component: Home },
    { path: "/users/:id", component: User },
  ]);
  r.outlet(host);
  assert.equal(host.querySelector("h1")!.textContent, "home");
  r.dispose();
});

test("navigate swaps the component and parses params", () => {
  reset("/");
  const host = body();
  const r = createRouter([
    { path: "/", component: Home },
    { path: "/users/:id", component: User },
  ]);
  r.outlet(host);
  r.navigate("/users/42");
  assert.equal(host.querySelector("h1")!.textContent, "user 42");
  assert.equal(r.current()!.ctx.params.id, "42");
  r.dispose();
});

test("back/forward (popstate) re-resolves", () => {
  reset("/");
  const host = body();
  const r = createRouter([
    { path: "/", component: Home },
    { path: "/users/:id", component: User },
  ]);
  r.outlet(host);
  r.navigate("/users/7");
  assert.equal(host.querySelector("h1")!.textContent, "user 7");
  (globalThis as { history: History }).history.replaceState(null, "", "/");
  popstate();
  assert.equal(host.querySelector("h1")!.textContent, "home");
  r.dispose();
});

test("outlet disposes the previous route on navigation (no leak)", () => {
  reset("/");
  const host = body();
  let cleaned = 0;
  const Tracked = component<RouteContext>(() => {
    onMount(() => () => {
      cleaned++;
    });
    return html`<p>tracked</p>`;
  });
  const Other = component<RouteContext>(() => html`<p>other</p>`);
  const r = createRouter([
    { path: "/", component: Tracked },
    { path: "/other", component: Other },
  ]);
  r.outlet(host);
  assert.equal(host.querySelector("p")!.textContent, "tracked");
  r.navigate("/other");
  assert.equal(cleaned, 1, "previous route torn down on navigation");
  assert.equal(host.querySelector("p")!.textContent, "other");
  r.dispose();
});

test("guard can redirect (UX-only)", () => {
  reset("/admin");
  const host = body();
  const r = createRouter(
    [
      { path: "/login", component: Home },
      { path: "/admin", component: User, guard: () => "/login" },
    ],
    { fallback: "/login" },
  );
  r.outlet(host);
  assert.equal(r.current()!.ctx.path, "/login");
  assert.equal(host.querySelector("h1")!.textContent, "home");
  r.dispose();
});

test("fallback when nothing matches", () => {
  reset("/nope");
  const host = body();
  const r = createRouter(
    [{ path: "/", component: Home }],
    { fallback: "/" },
  );
  r.outlet(host);
  assert.equal(host.querySelector("h1")!.textContent, "home");
  r.dispose();
});

test("lazy route loads and mounts", async () => {
  reset("/");
  const host = body();
  const r = createRouter([
    { path: "/", component: Home },
    { path: "/lazy", load: () => Promise.resolve({ default: User }) },
  ]);
  r.outlet(host);
  r.navigate("/lazy");
  await Promise.resolve(); // let the load() microtask settle
  await Promise.resolve();
  assert.equal(host.querySelector("h1")!.textContent, "user ");
  r.dispose();
});
