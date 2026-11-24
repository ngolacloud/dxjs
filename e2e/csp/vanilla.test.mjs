// Proof of the VANILLA (no-build) path: a hand-written .js module imports the
// single-file dxjs bundle (cdn/dxjs.js, copied here by the build) and renders a
// reactive app in Chrome under the strict CSP — proving dxjs is usable without a
// bundler, with zero CSP violations / page errors. (Run scripts/build.mjs first.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { start } from "./server.mjs";

test("dxjs works vanilla (no build) in Chrome under strict CSP", async () => {
  const { server, port } = await start(0);
  const channel = process.env.DXJS_PW_CHANNEL;
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        (window.__csp = window.__csp || []).push(e.violatedDirective + " " + e.blockedURI);
      });
    });

    await page.goto(`http://127.0.0.1:${port}/vanilla.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__dxready === true, { timeout: 5000 });

    // Reactivity: clicking increments the signal-bound text.
    assert.equal((await page.textContent("#inc")).trim(), "n = 0");
    await page.click("#inc");
    await page.click("#inc");
    assert.equal((await page.textContent("#inc")).trim(), "n = 2", "signal updated the DOM");

    const csp = await page.evaluate(() => window.__csp || []);
    assert.deepEqual(csp, [], `CSP violations: ${JSON.stringify(csp)}`);
    assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`);
  } finally {
    await browser.close();
    server.close();
  }
});
