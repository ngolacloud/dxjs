// End-to-end JSX proof: esbuild compiles app.tsx with the automatic JSX runtime
// pointed at @dxjs/jsx (resolved to source via the `development` condition), then
// we run the bundle against a happy-dom DOM and assert real rendering + reactive
// updates. Mirrors the build-then-run shape of the CSP e2e. Run with:
//   node --conditions=development --test packages/jsx/test/e2e/run.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { Window } from "happy-dom";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

test("a real .tsx compiles via esbuild and renders with reactive updates", async () => {
  const outfile = join(HERE, "app.built.mjs");
  await build({
    entryPoints: [join(HERE, "app.tsx")],
    outfile,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2021",
    jsx: "automatic",
    jsxImportSource: "@dxjs/jsx",
    conditions: ["development"], // resolve @dxjs/* to TS sources
    legalComments: "none",
  });

  // Install a DOM, then import the freshly built bundle.
  const win = new Window({ url: "https://local.test/" });
  const g = globalThis;
  g.window = win;
  g.document = win.document;
  g.Node = win.Node;
  g.Element = win.Element;
  g.HTMLElement = win.HTMLElement;
  g.Event = win.Event;

  const { renderApp } = await import(pathToFileURL(outfile).href);
  const host = win.document.createElement("div");
  win.document.body.appendChild(host);

  const dispose = renderApp(host);
  const btn = host.querySelector("button.counter");
  assert.ok(btn, "the JSX <button> rendered");
  assert.equal(btn.getAttribute("onclick"), null, "no inline handler attribute (CSP-safe)");
  assert.match(btn.textContent, /count:\s*0/, "initial reactive text");

  btn.dispatchEvent(new win.Event("click", { bubbles: true }));
  assert.match(btn.textContent, /count:\s*1/, "reactive text updated after the click");

  dispose();
  assert.equal(host.innerHTML, "", "disposer tore the tree down");
});
