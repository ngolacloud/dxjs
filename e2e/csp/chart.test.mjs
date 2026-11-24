// Browser proof for @dxjs/charts: load the charts demo in Chrome under the strict
// CSP, assert each Chart.js chart actually DREW to its <canvas> (non-blank pixels),
// prove a signal update re-renders a chart, and assert ZERO CSP violations / page
// errors. (Run via: node scripts/build.mjs first.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { start } from "./server.mjs";

// Count non-transparent pixels in a canvas (proof that Chart.js painted it).
function paintedPixels() {
  return [...document.querySelectorAll("canvas.dx-chart")].map((c) => {
    const ctx = c.getContext("2d");
    const { width, height } = c;
    if (!width || !height) return 0;
    const data = ctx.getImageData(0, 0, width, height).data;
    let n = 0;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) n++;
    return n;
  });
}

test("dxjs charts: Chart.js renders bar/line/doughnut in Chrome under strict CSP", async () => {
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

    await page.goto(`http://127.0.0.1:${port}/chart.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__dxready === true, { timeout: 5000 });

    // Three charts rendered, each with painted pixels.
    const painted = await page.evaluate(paintedPixels);
    assert.equal(painted.length, 3, `three canvases (got ${painted.length})`);
    for (const [i, n] of painted.entries()) {
      assert.ok(n > 500, `chart ${i} painted pixels (got ${n})`);
    }

    // Signal → chart.update(): mutate the revenue series and assert the bar canvas
    // pixel count changes (the chart re-rendered from the new data).
    const before = painted[0];
    await page.evaluate(() => window.__bump());
    await page.waitForTimeout(80);
    const after = (await page.evaluate(paintedPixels))[0];
    assert.notEqual(after, before, "the bar chart re-rendered after the signal changed");

    const csp = await page.evaluate(() => window.__csp || []);
    assert.deepEqual(csp, [], `CSP violations: ${JSON.stringify(csp)}`);
    assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`);
  } finally {
    await browser.close();
    server.close();
  }
});
