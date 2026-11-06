// Real-time proof: load the dxjs SSE app in Chrome under the strict CSP, confirm
// TWO topics share ONE connection (multiplexing), push deltas from the server and
// assert each bound DOM node updates in real time — with zero CSP violations.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { start } from "./live-server.mjs";

test("dxjs liveSignal: multiplexed SSE updates per component under strict CSP", async () => {
  const { close, port } = await start(0);
  const channel = process.env.DXJS_PW_CHANNEL;
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  const base = `http://127.0.0.1:${port}`;
  try {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on("pageerror", (e) => pageErrors.push(String(e)));
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        (window.__csp = window.__csp || []).push(e.violatedDirective);
      });
    });

    await page.goto(`${base}/live.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__dxready === true, { timeout: 5000 });
    assert.equal(await page.textContent("#ticker"), "ticker=0");
    assert.equal(await page.textContent("#status"), "status=unknown");

    // Multiplexing: 2 topics, exactly ONE server-side SSE connection.
    await page.waitForFunction(
      async () => (await (await fetch("/stats")).json()).connections === 1,
      { timeout: 5000 },
    );

    // Push deltas from the server; each bound node updates in real time.
    await page.evaluate(() => fetch("/push?topic=ticker&value=1234"));
    await page.waitForFunction(() => document.getElementById("ticker").textContent === "ticker=1234", {
      timeout: 5000,
    });
    await page.evaluate(() => fetch("/push?topic=status&value=ok"));
    await page.waitForFunction(() => document.getElementById("status").textContent === "status=ok", {
      timeout: 5000,
    });

    // Still a single connection after updates (no reconnection storm).
    const stats = await page.evaluate(async () => (await (await fetch("/stats")).json()).connections);
    assert.equal(stats, 1, "one multiplexed connection carries both topics");

    const csp = await page.evaluate(() => window.__csp || []);
    assert.deepEqual(csp, [], `CSP violations: ${JSON.stringify(csp)}`);
    assert.deepEqual(pageErrors, [], `page errors: ${JSON.stringify(pageErrors)}`);
  } finally {
    await browser.close();
    close();
  }
});
