// AUDIT PoC — M4 (MÉDIO): DNS rebinding. The dev server never validates the
// `Host` header, so a page on an attacker-controlled domain whose DNS is rebound
// to 127.0.0.1 can read responses from the developer's local server (source,
// env-driven assets, HMR graph). The fix is a Host allowlist
// (`localhost`/`127.0.0.1`/`[::1]` + the configured bind host). A request whose
// Host is off-list must be refused with 403. Fails pre-fix (served normally).
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDevServer } from "../src/server.ts";

function server() {
  const base = mkdtempSync(join(tmpdir(), "dxjs-m4-"));
  const app = join(base, "app");
  mkdirSync(app);
  writeFileSync(join(app, "entry.ts"), "export {}\n");
  return { base, dev: createDevServer({ entry: join(app, "entry.ts"), root: app }) };
}

test("M4: a request with an off-allowlist Host is refused (403)", async () => {
  const { base, dev } = server();
  try {
    const req = new Request("http://localhost/", { headers: { host: "attacker.example" } });
    const res = await dev.handler(req);
    assert.equal(res.status, 403, `rebinding host must be refused, got ${res.status}`);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("M4: allowlisted hosts (with port) are accepted", async () => {
  const { base, dev } = server();
  try {
    for (const host of ["localhost:5173", "127.0.0.1:5173", "[::1]:5173"]) {
      const res = await dev.handler(new Request("http://localhost/", { headers: { host } }));
      assert.notEqual(res.status, 403, `host ${host} must be accepted (got 403)`);
      assert.equal(res.status, 200, `host ${host} should reach the index (got ${res.status})`);
    }
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("M4: the configured bind host is on the allowlist", async () => {
  const base = mkdtempSync(join(tmpdir(), "dxjs-m4h-"));
  const app = join(base, "app");
  mkdirSync(app);
  writeFileSync(join(app, "entry.ts"), "export {}\n");
  const dev = createDevServer({ entry: join(app, "entry.ts"), root: app, host: "dev.local" });
  try {
    const ok = await dev.handler(new Request("http://localhost/", { headers: { host: "dev.local:5173" } }));
    assert.equal(ok.status, 200, "configured host must be accepted");
    const bad = await dev.handler(new Request("http://localhost/", { headers: { host: "other.local" } }));
    assert.equal(bad.status, 403, "a different host must still be refused");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
