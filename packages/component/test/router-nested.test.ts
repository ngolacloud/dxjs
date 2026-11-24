import { body, popstate } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { component, onMount, type RouteContext } from "../src/index.ts";
import { createRouter, Outlet } from "../src/router.ts";

function reset(path = "/") {
  (globalThis as { history: History }).history.replaceState(null, "", path);
}

test("nested routes render layout + child via Outlet", () => {
  reset("/users/1");
  const host = body();
  const Layout = component<RouteContext>(() => html`<div class="layout"><nav>users</nav>${Outlet()}</div>`);
  const Detail = component<RouteContext>((c) => html`<h1>user ${c.params.id}</h1>`);
  const r = createRouter([
    { path: "/users", component: Layout, children: [{ path: ":id", component: Detail }] },
  ]);
  r.outlet(host);
  assert.equal(host.querySelector("nav")!.textContent, "users");
  assert.equal(host.querySelector("h1")!.textContent, "user 1");
  assert.equal(r.matches().length, 2, "two levels in the chain");
  r.dispose();
});

test("sibling-child navigation PRESERVES the shared layout (its signal survives)", () => {
  reset("/users/1");
  const host = body();
  let layoutBuilds = 0;
  const Layout = component<RouteContext>(() => {
    layoutBuilds++;
    const ticks = signal(0);
    ticks.set(7); // layout-local state we expect to survive a child swap
    // expose the live count so the test can read it from the DOM
    return html`<div class="layout"><span id="ticks">${() => ticks()}</span>${Outlet()}</div>`;
  });
  const Detail = component<RouteContext>((c) => html`<h1>user ${c.params.id}</h1>`);
  const r = createRouter([
    { path: "/users", component: Layout, children: [{ path: ":id", component: Detail }] },
  ]);
  r.outlet(host);
  assert.equal(layoutBuilds, 1);
  assert.equal(host.querySelector("#ticks")!.textContent, "7");
  const layoutEl = host.querySelector(".layout");

  r.navigate("/users/2");
  assert.equal(host.querySelector("h1")!.textContent, "user 2", "child swapped");
  assert.equal(layoutBuilds, 1, "layout NOT rebuilt on sibling-child navigation");
  assert.equal(host.querySelector(".layout"), layoutEl, "same layout DOM node preserved");
  assert.equal(host.querySelector("#ticks")!.textContent, "7", "layout-local signal survived");
  r.dispose();
});

test("leaving the layout subtree tears it down (layout + child removed)", () => {
  reset("/users/1");
  const host = body();
  let childCleanups = 0;
  const Layout = component<RouteContext>(() => html`<div class="layout">${Outlet()}</div>`);
  const Detail = component<RouteContext>((c) => {
    onMount(() => () => {
      childCleanups++;
    });
    return html`<h1>user ${c.params.id}</h1>`;
  });
  const Home = component<RouteContext>(() => html`<h2>home</h2>`);
  const r = createRouter([
    { path: "/", component: Home },
    { path: "/users", component: Layout, children: [{ path: ":id", component: Detail }] },
  ]);
  r.outlet(host);
  assert.notEqual(host.querySelector(".layout"), null);
  r.navigate("/");
  assert.equal(host.querySelector("h2")!.textContent, "home");
  assert.equal(host.querySelector(".layout"), null, "layout subtree removed when leaving it");
  assert.equal(childCleanups, 1, "nested child torn down with the layout");
  r.dispose();
});

test("loader result flows to the component as ctx.data() (reactive)", async () => {
  reset("/p/42");
  const host = body();
  const Page = component<RouteContext>((c) =>
    html`<h1>${() => (c.data() ? (c.data() as { title: string }).title : "loading")}</h1>`,
  );
  let resolveLoad: (v: { title: string }) => void = () => {};
  const r = createRouter([
    {
      path: "/p/:id",
      component: Page,
      loader: (c) => new Promise<{ title: string }>((res) => {
        resolveLoad = () => res({ title: "post " + c.params.id });
      }),
    },
  ]);
  r.outlet(host);
  // Renders immediately with the loading state (resolve is NOT blocked on loader).
  assert.equal(host.querySelector("h1")!.textContent, "loading");
  resolveLoad({ title: "" });
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(host.querySelector("h1")!.textContent, "post 42", "data() updated after loader resolved");
  r.dispose();
});

test("synchronous loader data is available on first render", () => {
  reset("/s");
  const host = body();
  const Page = component<RouteContext>((c) => html`<h1>${() => String(c.data())}</h1>`);
  const r = createRouter([{ path: "/s", component: Page, loader: () => "ready" }]);
  r.outlet(host);
  assert.equal(host.querySelector("h1")!.textContent, "ready");
  r.dispose();
});

test("popstate re-resolves nested routes", () => {
  reset("/users/1");
  const host = body();
  const Layout = component<RouteContext>(() => html`<div class="layout">${Outlet()}</div>`);
  const Detail = component<RouteContext>((c) => html`<h1>user ${c.params.id}</h1>`);
  const r = createRouter([
    { path: "/users", component: Layout, children: [{ path: ":id", component: Detail }] },
  ]);
  r.outlet(host);
  r.navigate("/users/9");
  assert.equal(host.querySelector("h1")!.textContent, "user 9");
  (globalThis as { history: History }).history.replaceState(null, "", "/users/1");
  popstate();
  assert.equal(host.querySelector("h1")!.textContent, "user 1");
  r.dispose();
});
