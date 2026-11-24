// Browser proof for the delonix-dx-console proof of concept: the dashboard + the
// containers interface, driven in Chrome under the strict CSP. Proves the whole
// parity stack works together — @dxjs/query (list + invalidate after an action),
// @dxjs/ui dataTable, @dxjs/charts, @dxjs/forms (deploy), virtualList (logs) — with
// ZERO CSP violations / page errors. (Run build.mjs first.)
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
      res.end("not found");
    }
  });
  return new Promise((r) => server.listen(0, "127.0.0.1", () => r({ server, port: server.address().port })));
}

test("delonix-dx-console: dashboard + containers work on dxjs under strict CSP", async () => {
  const { server, port } = await startServer();
  const channel = process.env.DXJS_PW_CHANNEL;
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 1000 } });
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        (window.__csp = window.__csp || []).push(e.violatedDirective + " " + e.blockedURI);
      });
    });

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__dxready === true, { timeout: 5000 });

    // --- Dashboard: shell + KPI tiles + a painted chart ---
    assert.equal(await page.textContent(".dx-brand"), "Delonix");
    await page.waitForSelector(".dx-stat", { timeout: 5000 });
    assert.equal((await page.$$(".dx-stat")).length, 5, "five KPI tiles");
    await page.waitForSelector("canvas.dx-chart", { timeout: 5000 });
    await page.waitForTimeout(120);
    const painted = await page.evaluate(() => {
      const c = document.querySelector("canvas.dx-chart");
      const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
      let n = 0;
      for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) n++;
      return n;
    });
    assert.ok(painted > 500, `status doughnut painted (${painted})`);

    // --- Navigate to Containers ---
    await page.click(".dx-nav-item >> text=Containers");
    await page.waitForSelector("tbody tr .acts", { timeout: 5000 });
    const rows0 = (await page.$$("tbody tr")).length;
    assert.ok(rows0 > 0, "container rows rendered");

    // --- @dxjs/forms: deploy a container, @dxjs/query invalidates → it appears ---
    await page.click(".dx-btn.is-primary >> text=Deploy container");
    await page.waitForSelector("form.deploy");
    await page.fill('form.deploy input[placeholder^="name"]', "web-poc");
    await page.fill('form.deploy input[placeholder^="image"]', "nginx");
    await page.click("form.deploy button[type=submit]");
    await page.waitForSelector("td >> text=web-poc", { timeout: 5000 });

    // --- lifecycle action: stop a running container → @dxjs/query invalidates →
    // the list refetches and the visible "running" pill count drops by one ---
    const runningBefore = await page.locator(".dx-pill", { hasText: /^running$/i }).count();
    assert.ok(runningBefore > 0, "there is a running container to stop");
    await page.locator('.act[title="stop"]').first().click();
    await page.waitForFunction(
      (n) => [...document.querySelectorAll(".dx-pill")].filter((p) => /^running$/i.test(p.textContent.trim())).length < n,
      runningBefore,
      { timeout: 5000 },
    );

    // --- virtualList: logs render a small window for thousands of lines ---
    await page.waitForSelector(".dx-vlist-row", { timeout: 5000 });
    const logRows = await page.$$eval(".dx-vlist-row", (els) => els.length);
    assert.ok(logRows > 0 && logRows < 60, `logs virtualized (${logRows} DOM rows for thousands of lines)`);

    // --- no CSP violations, no page errors anywhere in the flow ---
    const csp = await page.evaluate(() => window.__csp || []);
    assert.deepEqual(csp, [], `CSP violations: ${JSON.stringify(csp)}`);
    assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`);
  } finally {
    await browser.close();
    server.close();
  }
});
