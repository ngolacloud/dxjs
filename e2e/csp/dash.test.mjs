// Browser proof for @dxjs/ui: the styled admin dashboard renders under the strict
// CSP (style-src 'self' via the same-origin dash.css), the data table sorts and
// paginates, and there are ZERO CSP violations / page errors.
import { test } from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { start } from "./server.mjs";

test("dxjs/ui dashboard renders & the table works under strict CSP", async () => {
  const { server, port } = await start(0);
  const channel = process.env.DXJS_PW_CHANNEL;
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const problems = [];
    page.on("pageerror", (e) => problems.push("pageerror:" + e));
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) =>
        (window.__csp = window.__csp || []).push(e.violatedDirective + " " + e.blockedURI),
      );
    });

    await page.goto(`http://127.0.0.1:${port}/dash.html`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__dxready === true, { timeout: 5000 });

    // Shell + KPI tiles + table rendered.
    assert.equal(await page.textContent(".dx-brand"), "TalentPros");
    assert.equal((await page.$$(".dx-stat")).length, 8, "eight KPI tiles");
    assert.equal((await page.$$("tbody tr")).length, 8, "first page shows pageSize rows");

    // The stylesheet actually applied (dark sidebar) — proves style-src 'self' loaded dash.css.
    const sideBg = await page.$eval(".dx-side", (el) => getComputedStyle(el).backgroundColor);
    assert.notEqual(sideBg, "rgba(0, 0, 0, 0)", "sidebar is styled by the linked stylesheet");

    // Pagination.
    await page.click("text=Next ›");
    assert.ok((await page.textContent(".dx-tbl-foot")).includes("of 23"));

    // Sort by MRR → the visible column becomes monotonic.
    await page.click("th.is-sortable >> text=MRR");
    const mrr = await page.$$eval("tbody tr", (trs) =>
      trs.map((tr) => Number(tr.children[2].textContent.replace("$", ""))),
    );
    const asc = mrr.every((v, i) => i === 0 || mrr[i - 1] <= v);
    const desc = mrr.every((v, i) => i === 0 || mrr[i - 1] >= v);
    assert.ok(asc || desc, `sorted MRR must be monotonic, got ${mrr}`);

    const csp = await page.evaluate(() => window.__csp || []);
    assert.deepEqual(csp, [], `CSP violations: ${JSON.stringify(csp)}`);
    assert.deepEqual(problems, [], `page errors: ${JSON.stringify(problems)}`);
  } finally {
    await browser.close();
    server.close();
  }
});
