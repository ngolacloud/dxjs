// The real proof of dxjs HMR with signal preservation, under a STRICT CSP.
//
// Boots @dxjs/dev against a throwaway counter module, drives it in a headless
// browser, edits the module's <h1> on disk, and asserts the heading re-renders
// WITHOUT a full reload while the counter signal survives (stays at 2, not 0) —
// and that zero CSP violations and zero page errors occurred.
//
// Run: node --conditions=development --test e2e/hmr/hmr.test.mjs
// Requires Playwright (bundled Chromium is fine — no system Chrome needed).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { createDevServer } from "../../packages/dev/src/server.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
// Inside the repo so the dev server's /@fs guard admits it (it rejects paths
// outside the monorepo root).
const WORK = join(HERE, ".work");

const COUNTER = (heading) => `import { signal } from "@dxjs/core";
import { html, render } from "@dxjs/dom";

const hot = (import.meta).hot;
const store = (hot?.data ?? {});
const host = document.getElementById("app");
const count = (store.count ??= signal(0));
store.dispose?.();
const view = () => html\`
  <main class="counter">
    <h1>${heading}</h1>
    <button id="inc" @click=\${() => count((c) => c + 1)}>count = \${() => count()}</button>
  </main>
\`;
store.dispose = render(view(), host);
window.__dxready = true;
hot?.accept();
`;

const CSS = ".counter { margin: 2rem; } #inc { padding: .5rem 1rem; }";

test("dxjs HMR preserves signal state across an edit, under a strict CSP", async () => {
  await rm(WORK, { recursive: true, force: true });
  await mkdir(WORK, { recursive: true });
  const entry = join(WORK, "counter.ts");
  await writeFile(entry, COUNTER("HMR BEFORE"));
  await writeFile(join(WORK, "counter.css"), CSS);

  const server = createDevServer({ entry, root: WORK, css: ["counter.css"], port: 0, title: "hmr" });
  const port = await server.listen();

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        (window.__csp = window.__csp || []).push(e.violatedDirective + " " + e.blockedURI);
      });
    });

    // Not "networkidle": the HMR long-poll holds a connection open, so the
    // network is never idle. Wait for the module graph to boot instead.
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dxready === true, { timeout: 10000 });

    // Baseline: the markup rendered and reacts to clicks.
    assert.equal(await page.textContent("h1"), "HMR BEFORE");
    assert.equal(await page.textContent("#inc"), "count = 0");
    await page.click("#inc");
    await page.click("#inc");
    assert.equal(await page.textContent("#inc"), "count = 2");

    // A sentinel a full reload would wipe (reload re-runs the page from scratch).
    await page.evaluate(() => (window.__sentinel = "KEEP"));

    // Edit the component's markup on disk → the dev server should hot-swap it.
    await writeFile(entry, COUNTER("HMR AFTER"));

    // The heading updates (proves re-render happened)…
    await page.waitForFunction(() => document.querySelector("h1")?.textContent === "HMR AFTER", {
      timeout: 8000,
    });

    // …and the signal SURVIVED: the counter is still 2, not reset to 0.
    assert.equal(await page.textContent("#inc"), "count = 2", "signal must survive the module swap");
    // …and it was NOT a full reload: the sentinel is intact.
    assert.equal(await page.evaluate(() => window.__sentinel), "KEEP", "must not be a full reload");

    // The signal still reacts after the swap (new handler wired to same signal).
    await page.click("#inc");
    assert.equal(await page.textContent("#inc"), "count = 3", "signal must stay reactive after HMR");

    // Strict CSP held: no violations, no page errors.
    const csp = await page.evaluate(() => window.__csp || []);
    assert.deepEqual(csp, [], `CSP violations: ${JSON.stringify(csp)}`);
    assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`);
  } finally {
    await browser.close();
    await server.close();
    await rm(WORK, { recursive: true, force: true });
  }
});
