// LIVE integration proof: run the real Seiva `admin-e2e` backend, serve the dxjs
// seiva-console from a same-origin proxy, drive it in Chrome, enter the real
// bearer, and assert the console renders the server's authorized `accounts`
// resource from the live /admin/registry.json + /openapi.json — under a strict
// CSP, with zero violations.
//
// Local/on-demand (NOT CI): needs the compiled Seiva binary at
// ../../../seiva/target/debug/admin-e2e and system Chrome (DXJS_PW_CHANNEL=chrome).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "playwright";
import { start } from "./proxy.mjs";

const BIN = new URL("../../../seiva/target/debug/admin-e2e", import.meta.url).pathname;
const BACKEND_ADDR = "127.0.0.1:8137";
const BACKEND = `http://${BACKEND_ADDR}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("dxjs seiva-console renders a REAL Seiva backend under strict CSP", async (t) => {
  if (!existsSync(BIN)) {
    t.skip(`Seiva admin-e2e binary not found at ${BIN} (build it: cargo build -p admin-e2e)`);
    return;
  }
  const srv = spawn(BIN, { env: { ...process.env, ADMIN_E2E_ADDR: BACKEND_ADDR }, stdio: "ignore" });
  const proxy = await start(BACKEND, 0);
  const channel = process.env.DXJS_PW_CHANNEL;
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  try {
    // Wait for the backend to answer.
    let up = false;
    for (let i = 0; i < 60; i++) {
      try {
        if ((await fetch(`${BACKEND}/admin`)).ok) { up = true; break; }
      } catch { /* not yet */ }
      await sleep(250);
    }
    assert.ok(up, "admin-e2e backend came up");

    const page = await browser.newPage();
    const csp = [];
    page.on("pageerror", (e) => csp.push("pageerror:" + e));
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        (window.__csp = window.__csp || []).push(e.violatedDirective);
      });
    });

    await page.goto(`http://127.0.0.1:${proxy.port}/`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => window.__dxready === true, { timeout: 5000 });

    // Anonymous (no token): the server-filtered registry returns nothing.
    await page.waitForFunction(() => /No resources|no resources/i.test(document.getElementById("intro")?.textContent || ""), { timeout: 5000 });

    // Enter the real bearer → the console reloads and the authorized resource appears.
    await page.fill("#token", "clerk-token");
    await page.dispatchEvent("#token", "change");
    await page.waitForSelector(".res h2", { timeout: 8000 });
    const label = await page.textContent(".res h2");
    assert.match(label, /accounts/i, `the live 'accounts' resource rendered (got "${label}")`);

    // The resource renders actionable operation form(s) from the live contract
    // (accounts has no GET list → operation-forms path; a POST create form among them).
    assert.ok(await page.$(".res form.op"), "at least one operation form rendered for the resource");
    const hasPost = await page.$$eval(".res .sig .m", (els) => els.some((e) => e.textContent === "POST"));
    assert.ok(hasPost, "a POST (create) operation is offered to the authorized caller");

    const violations = await page.evaluate(() => window.__csp || []);
    assert.deepEqual(violations, [], `CSP violations/page errors: ${JSON.stringify(violations)}`);
  } finally {
    await browser.close();
    proxy.close();
    srv.kill("SIGTERM");
  }
});
