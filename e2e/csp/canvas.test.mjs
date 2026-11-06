// Browser proof for @dxjs/canvas: load the pipeline demo in Chrome under the
// strict CSP, drag a node with real mouse events, and assert it moved — with
// zero CSP violations / page errors. (Run via: node scripts/build.mjs first.)
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { start } from "./server.mjs";

test("dxjs canvas: drag a pipeline node in Chrome under strict CSP", async () => {
  const { server, port } = await start(0);
  const channel = process.env.DXJS_PW_CHANNEL;
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        (window.__csp = window.__csp || []).push(e.violatedDirective);
      });
    });

    await page.goto(`http://127.0.0.1:${port}/canvas.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__dxready === true, { timeout: 5000 });

    // The sample pipeline has 3 nodes and 2 edges.
    const counts = await page.evaluate(() => ({
      nodes: window.__graph.nodes().length,
      edges: window.__graph.edges().length,
      srcX: window.__graph.node("src").x,
      srcY: window.__graph.node("src").y,
    }));
    assert.equal(counts.nodes, 3);
    assert.equal(counts.edges, 2);

    // Screen position of the Source node's centre (viewport is identity).
    const start0 = await page.evaluate(() => {
      const r = document.getElementById("c").getBoundingClientRect();
      const n = window.__graph.node("src");
      return { x: r.left + n.x + n.width / 2, y: r.top + n.y + n.height / 2 };
    });

    await page.mouse.move(start0.x, start0.y);
    await page.mouse.down();
    await page.mouse.move(start0.x + 80, start0.y + 60, { steps: 4 });
    await page.mouse.up();

    const moved = await page.evaluate(() => ({
      x: window.__graph.node("src").x,
      y: window.__graph.node("src").y,
    }));
    assert.ok(Math.abs(moved.x - (counts.srcX + 80)) < 2, `x moved ~+80 (got ${moved.x})`);
    assert.ok(Math.abs(moved.y - (counts.srcY + 60)) < 2, `y moved ~+60 (got ${moved.y})`);

    const csp = await page.evaluate(() => window.__csp || []);
    assert.deepEqual(csp, [], `CSP violations: ${JSON.stringify(csp)}`);
    assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`);
  } finally {
    await browser.close();
    server.close();
  }
});
