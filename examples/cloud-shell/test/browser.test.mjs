// Browser proof: load the BUILT cloud-shell under the strict CSP, render the
// shell, navigate between pages, and assert ZERO CSP violations / page errors.
// Run: node examples/cloud-shell/build.mjs && node --test examples/cloud-shell/test/browser.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";
import { chromium } from "playwright";

const DIST = new URL("../dist/", import.meta.url).pathname;
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

function startServer() {
  const server = createServer((req, res) => {
    const path = req.url === "/" || !req.url ? "/index.html" : req.url.split("?")[0];
    try {
      const b = readFileSync(join(DIST, path));
      res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream", "content-security-policy": CSP });
      res.end(b);
    } catch {
      res.writeHead(404, { "content-security-policy": CSP });
      res.end("not found — run build.mjs");
    }
  });
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

test("cloud-shell renders and navigates under a strict CSP (no violations)", async () => {
  const { server, port } = await startServer();
  const channel = process.env.DXJS_PW_CHANNEL;
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        (window.__csp = window.__csp || []).push(e.violatedDirective + " " + e.blockedURI);
      });
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__dxready === true, { timeout: 5000 });

    // The shell rendered (dogfooded @dxjs/ui appShell).
    assert.equal(await page.textContent(".dx-brand"), "dxjs Cloud");
    assert.equal((await page.$$(".dx-nav-item")).length, 4);
    assert.ok(await page.$(".dx-stat"), "dashboard tiles rendered");

    // Navigate to the Terminal page (nested router) and see the live panel.
    await page.click(".dx-nav-item:has-text('Terminal')");
    await page.waitForSelector(".dx-term", { timeout: 3000 });
    assert.ok((await page.textContent(".dx-term-out")).includes("Welcome to the dxjs Cloud Shell"));

    // Navigate to Resources and see the k8s explorer rows.
    await page.click(".dx-nav-item:has-text('Resources')");
    await page.waitForSelector("tbody tr", { timeout: 3000 });
    const names = await page.$$eval("tbody tr td:first-child", (tds) => tds.map((t) => t.textContent));
    assert.ok(names.includes("web-7f9"), "pods listed");

    // Strict CSP held: no violations, no page errors.
    const csp = await page.evaluate(() => window.__csp || []);
    assert.deepEqual(csp, [], `CSP violations: ${JSON.stringify(csp)}`);
    assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`);
  } finally {
    await browser.close();
    server.close();
  }
});
