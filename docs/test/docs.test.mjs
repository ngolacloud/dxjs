// Browser proof for the docs site (dogfooding): serve docs/dist under the SAME
// strict CSP as the library's own proofs, navigate pages, exercise a live example
// and a live chart, and assert ZERO CSP violations / page errors. This doubles as
// the vanilla+CSP proof for the whole kit. (Run `node docs/build.mjs` first.)
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
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve({ server, port: server.address().port })));
}

const painted = () =>
  [...document.querySelectorAll("canvas.dx-chart")].map((c) => {
    const ctx = c.getContext("2d");
    if (!c.width || !c.height) return 0;
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i] !== 0) n++;
    return n;
  });

test("dxjs docs site renders, navigates, runs live examples & charts under strict CSP", async () => {
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

    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__dxready === true, { timeout: 5000 });

    // The shell (dogfooded @dxjs/ui) rendered with the nav.
    assert.equal(await page.textContent(".dx-brand"), "dxjs");
    assert.ok((await page.$$(".dx-nav-item")).length >= 8, "a nav entry per page");
    // The default page shows a code pane (code + result layout).
    assert.ok(await page.$(".ex-code"), "an example's code pane rendered");

    // Navigate to @dxjs/core and drive the live counter example.
    await page.click(".dx-nav-item >> text=@dxjs/core");
    await page.waitForSelector(".demo-btn");
    const before = (await page.textContent(".demo-out")).trim();
    await page.click(".demo-btn");
    const after = (await page.textContent(".demo-out")).trim();
    assert.notEqual(after, before, `the live core example reacted (${before} → ${after})`);

    // Navigate to @dxjs/charts and assert Chart.js actually painted a canvas.
    await page.click(".dx-nav-item >> text=@dxjs/charts");
    await page.waitForSelector("canvas.dx-chart", { timeout: 5000 });
    await page.waitForTimeout(120);
    const px = await page.evaluate(painted);
    assert.ok(px.length >= 1 && px.every((n) => n > 500), `charts painted on the charts page (${px})`);

    // @dxjs/ui virtualList: 10,000 items but only a small window is in the DOM.
    await page.click(".dx-nav-item >> text=@dxjs/ui");
    await page.waitForSelector(".dx-vlist-row", { timeout: 5000 });
    const domRows = await page.$$eval(".dx-vlist-row", (els) => els.length);
    assert.ok(domRows > 0 && domRows < 60, `virtualized: few DOM rows for 10k items (got ${domRows})`);
    // Scroll and confirm it still renders a small window (and different rows).
    const firstBefore = await page.textContent(".dx-vlist-row");
    await page.$eval(".dx-vlist", (el) => (el.scrollTop = 3600));
    await page.waitForTimeout(60);
    const domRows2 = await page.$$eval(".dx-vlist-row", (els) => els.length);
    const firstAfter = await page.textContent(".dx-vlist-row");
    assert.ok(domRows2 < 60, `still windowed after scroll (got ${domRows2})`);
    assert.notEqual(firstAfter, firstBefore, "scrolling moved the window");

    const csp = await page.evaluate(() => window.__csp || []);
    assert.deepEqual(csp, [], `CSP violations: ${JSON.stringify(csp)}`);
    assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`);
  } finally {
    await browser.close();
    server.close();
  }
});
