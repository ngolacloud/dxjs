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

    // The delonix-style shell rendered with the grouped side nav.
    assert.equal(await page.textContent(".dtop-name"), "dxjs");
    assert.ok((await page.$$(".dnav-link")).length >= 8, "a nav entry per page");
    assert.ok(await page.$(".dnav-grouplabel"), "grouped sidebar");

    // Default page = the bilingual landing hero.
    assert.ok(await page.$(".lp-title"), "landing hero rendered");
    const ptTitle = (await page.textContent(".lp-title")).trim();
    // The live landing counter reacts (dogfooded signals).
    const lbBefore = (await page.textContent(".lp-demo-live .dx-btn")).trim();
    await page.click(".lp-demo-live .dx-btn");
    const lbAfter = (await page.textContent(".lp-demo-live .dx-btn")).trim();
    assert.notEqual(lbAfter, lbBefore, `landing counter reacted (${lbBefore} → ${lbAfter})`);
    // The language switch flips the copy live (pt-AO → en), no reload.
    await page.click(".dtop .dx-seg-item >> text=EN");
    const enTitle = (await page.textContent(".lp-title")).trim();
    assert.notEqual(enTitle, ptTitle, `language toggled live (${ptTitle} → ${enTitle})`);

    // Component gallery: the v2 kit renders live (e.g. a switch + a date picker).
    await page.click(".dnav-link >> text=Gallery");
    await page.waitForSelector(".dx-switch", { timeout: 5000 });
    assert.ok(await page.$(".dx-dp-face"), "the date picker rendered in the gallery");
    assert.ok(await page.$(".dx-s2-face"), "the searchable select rendered in the gallery");

    // Advanced suite is live: calendar (with a holiday mark), gantt, map.
    assert.ok(await page.$(".dx-cal-cell.is-holiday"), "calendar marks an Angolan holiday");
    assert.ok(await page.$(".dx-gantt-bar"), "gantt rendered bars");
    assert.ok((await page.$$(".dx-map-pin")).length >= 3, "world map plotted markers");
    assert.ok(await page.$(".dx-metric-value"), "metric tiles rendered");

    // Table export menu opens with 3 formats (CSV/XLS/XLSX).
    await page.click(".dx-export-btn");
    await page.waitForSelector(".dx-export-menu:not([hidden])", { timeout: 2000 });
    assert.equal((await page.$$(".dx-export-item")).length, 3, "CSV + XLS + XLSX");

    // Ctrl+K focuses the Odoo-style search/filter input (the headline hotkey).
    await page.keyboard.press("Control+K");
    assert.ok(await page.evaluate(() => document.activeElement?.classList.contains("dx-sf-input")), "Ctrl+K focused the search input");

    // Getting started: dual Browser(CDN)|Node runnable example with full file names,
    // syntax highlighting, copy buttons and a Desktop/Mobile preview toggle.
    await page.click(".dnav-link >> text=Getting started");
    await page.waitForSelector(".run-tabs", { timeout: 5000 });
    assert.ok((await page.textContent(".cb-name")).includes("index.html"), "code block shows the browser filename");
    assert.ok(await page.$(".cb-pre .tok-kw"), "syntax highlighting emitted token spans");
    assert.ok((await page.$$(".cb-copy")).length > 0, "copy buttons rendered on code blocks");
    // the CDN variant loads dxjs from esm.sh (shown as code text)
    assert.ok((await page.textContent(".run-pane:not([hidden]) .cb-pre")).includes("esm.sh"), "browser tab shows CDN import");
    await page.locator(".run-tab", { hasText: "Node" }).first().click();
    await page.waitForTimeout(40);
    assert.ok((await page.textContent(".run-pane:not([hidden]) .cb-pre")).includes("npm install"), "Node tab shows install step");

    // Responsive: the appShell exposes a hamburger (shown via CSS on small screens).
    assert.ok(await page.$(".dtop-burger"), "responsive hamburger present in the shell");

    // Navigate to @dxjs/core and drive the live counter example.
    await page.click(".dnav-link >> text=@dxjs/core");
    await page.waitForSelector(".demo-btn");
    // Live examples carry a Desktop/Mobile preview toggle; switching to Mobile
    // constrains the preview frame.
    assert.ok(await page.$(".pv-seg"), "device Desktop/Mobile toggle on the live example");
    await page.click(".pv-toggle .pv-seg >> text=Mobile");
    assert.ok(await page.$(".pv-stage.is-mobile"), "preview switched to the mobile frame");
    const before = (await page.textContent(".demo-out")).trim();
    await page.click(".demo-btn");
    const after = (await page.textContent(".demo-out")).trim();
    assert.notEqual(after, before, `the live core example reacted (${before} → ${after})`);

    // Navigate to @dxjs/charts and assert Chart.js actually painted a canvas.
    await page.click(".dnav-link >> text=@dxjs/charts");
    await page.waitForSelector("canvas.dx-chart", { timeout: 5000 });
    await page.waitForTimeout(120);
    const px = await page.evaluate(painted);
    assert.ok(px.length >= 1 && px.every((n) => n > 500), `charts painted on the charts page (${px})`);

    // @dxjs/ui virtualList: 10,000 items but only a small window is in the DOM.
    await page.click(".dnav-link >> text=@dxjs/ui");
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
