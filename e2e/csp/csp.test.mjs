// The real proof: load the dxjs demo in Chrome under a STRICT CSP (no
// unsafe-eval, no unsafe-inline) and assert it renders, reacts to a click, does
// NOT execute injected data (XSS), and raises ZERO CSP violations / page errors.
//
// Run: node scripts/build.mjs && node --test e2e/csp/csp.test.mjs
// Requires Playwright + system Chrome (PLAYWRIGHT skip-download; channel chrome).
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { start } from "./server.mjs";

test("dxjs runs under a strict CSP in Chrome (no eval, no inline, XSS-safe)", async () => {
  const { server, port } = await start(0);
  // Default to Playwright's bundled Chromium; DXJS_PW_CHANNEL=chrome uses system Chrome.
  const channel = process.env.DXJS_PW_CHANNEL;
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  try {
    const page = await browser.newPage();
    const violations = [];
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        (window.__csp = window.__csp || []).push(e.violatedDirective + " " + e.blockedURI);
      });
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__dxready === true, { timeout: 5000 });

    // Reactivity works under strict CSP (would be impossible with eval blocked).
    assert.equal(await page.textContent("#inc"), "n = 0");
    await page.click("#inc");
    await page.click("#inc");
    assert.equal(await page.textContent("#inc"), "n = 2");

    // The dangerous data value was escaped — no <img>, no onerror fired.
    assert.equal(await page.$("#danger img"), null, "data must not become an element");
    assert.equal(await page.evaluate(() => window.__xss), undefined, "no XSS execution");

    // No CSP violations, no page errors.
    const csp = await page.evaluate(() => window.__csp || []);
    assert.deepEqual(csp, [], `CSP violations: ${JSON.stringify(csp)}`);
    assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`);
  } finally {
    await browser.close();
    server.close();
  }
});
