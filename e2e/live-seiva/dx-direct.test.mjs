// Cutover proof (ADR 0016): the Seiva backend serves the dxjs console ITSELF at
// /admin/dx (vendored bundle), so there is no proxy — the browser loads /admin/dx
// under Seiva's own admin_dx_csp (script-src 'self'; connect-src 'self'), the
// dxjs app fetches the real same-origin /admin/registry.json + /openapi.json, and
// the authorized `accounts` resource renders. Zero CSP violations / page errors.
//
// Local/on-demand (NOT CI): needs seiva/target/debug/admin-e2e (built with
// mount_dx) + system Chrome (DXJS_PW_CHANNEL=chrome).
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { chromium } from "playwright";

const BIN = new URL("../../../seiva/target/debug/admin-e2e", import.meta.url).pathname;
const ADDR = "127.0.0.1:8138";
const BASE = `http://${ADDR}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test("Seiva serves the dxjs console at /admin/dx (cutover, same-origin, strict CSP)", async (t) => {
  if (!existsSync(BIN)) {
    t.skip(`admin-e2e binary not found at ${BIN} (cargo build -p admin-e2e)`);
    return;
  }
  const srv = spawn(BIN, { env: { ...process.env, ADMIN_E2E_ADDR: ADDR }, stdio: "ignore" });
  const channel = process.env.DXJS_PW_CHANNEL;
  const browser = await chromium.launch({ headless: true, ...(channel ? { channel } : {}) });
  try {
    let up = false;
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(`${BASE}/admin/dx`)).ok) { up = true; break; } } catch { /* wait */ }
      await sleep(250);
    }
    assert.ok(up, "admin-e2e serving /admin/dx");

    const page = await browser.newPage();
    const problems = [];
    page.on("pageerror", (e) => problems.push("pageerror:" + e));
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        (window.__csp = window.__csp || []).push(e.violatedDirective + " " + e.blockedURI);
      });
    });

    await page.goto(`${BASE}/admin/dx`, { waitUntil: "networkidle" });
    await page.waitForSelector("#token", { timeout: 5000 }); // the dxjs console shell rendered

    await page.fill("#token", "clerk-token");
    await page.dispatchEvent("#token", "change");
    await page.waitForSelector(".res h2", { timeout: 8000 });
    const label = await page.textContent(".res h2");
    assert.match(label, /accounts/i, `live 'accounts' resource rendered by the dxjs console (got "${label}")`);

    const csp = await page.evaluate(() => window.__csp || []);
    assert.deepEqual(csp, [], `CSP violations: ${JSON.stringify(csp)}`);
    assert.deepEqual(problems, [], `page errors: ${JSON.stringify(problems)}`);
  } finally {
    await browser.close();
    srv.kill("SIGTERM");
  }
});
