// AUDIT PoC — M3 (MÉDIO): path traversal in the dev static server. `serveStatic`
// guards with `abs.startsWith(root)`, a STRING-prefix check: a sibling directory
// that shares the root's prefix (e.g. root `…/app`, sibling `…/app-x`) passes the
// guard, so `/@app/<encoded ../>app-x/secret` escapes the app root. `new URL()`
// collapses any `..` whose slash is literal, so the real vector encodes the
// slash too (`%2e%2e%2f`): WHATWG URL keeps it as one opaque segment, and the
// handler's `decodeURIComponent` then turns it back into `../`, landing on the
// sibling. This also asserts dotfiles (e.g. `.env`) are never served. Both fail pre-fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDevServer } from "../src/server.ts";

function fixture() {
  const base = mkdtempSync(join(tmpdir(), "dxjs-m3-"));
  const app = join(base, "app"); // the served root
  const sibling = join(base, "app-x"); // shares the "app" prefix
  mkdirSync(app);
  mkdirSync(sibling);
  writeFileSync(join(app, "entry.ts"), "export {}\n");
  writeFileSync(join(app, ".env"), "DB_PASSWORD=super-secret\n");
  writeFileSync(join(sibling, "secret"), "STOLEN-FROM-SIBLING\n");
  const server = createDevServer({ entry: join(app, "entry.ts"), root: app });
  return { base, server };
}

test("M3: a sibling sharing the root prefix must not be reachable (403, not the secret)", async () => {
  const { base, server } = fixture();
  try {
    // `%2e%2e%2f` keeps `../` as one opaque segment through URL normalisation,
    // then `decodeURIComponent` restores it — the authentic traversal vector.
    const req = new Request("http://localhost/@app/%2e%2e%2fapp-x%2fsecret", {
      headers: { host: "localhost" },
    });
    const res = await server.handler(req);
    const body = await res.text();
    assert.equal(res.status, 403, `expected 403, got ${res.status} body=${JSON.stringify(body)}`);
    assert.ok(!body.includes("STOLEN-FROM-SIBLING"), "sibling secret must never be served");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("M3: dotfiles inside the root (e.g. .env) must not be served (403)", async () => {
  const { base, server } = fixture();
  try {
    const req = new Request("http://localhost/@app/.env", { headers: { host: "localhost" } });
    const res = await server.handler(req);
    const body = await res.text();
    assert.equal(res.status, 403, `expected 403 for dotfile, got ${res.status}`);
    assert.ok(!body.includes("super-secret"), ".env contents must never be served");
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});

test("M3: a legitimate asset inside the root is still served (200)", async () => {
  const base = mkdtempSync(join(tmpdir(), "dxjs-m3ok-"));
  const app = join(base, "app");
  mkdirSync(app);
  writeFileSync(join(app, "entry.ts"), "export {}\n");
  writeFileSync(join(app, "style.css"), "body{color:red}\n");
  const server = createDevServer({ entry: join(app, "entry.ts"), root: app });
  try {
    const req = new Request("http://localhost/@app/style.css", { headers: { host: "localhost" } });
    const res = await server.handler(req);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /color:red/);
  } finally {
    rmSync(base, { recursive: true, force: true });
  }
});
