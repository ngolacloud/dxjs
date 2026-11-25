// AUDIT PoC — L4: the /@fs dev route guards containment with isWithin(abs, REPO)
//   on the LINK path, but never realpath()s. A symlink INSIDE the repo pointing
//   OUTSIDE escapes the guard (served through the link). And a transform error
//   echoed the raw esbuild message (source frames/paths) to the client. Asserts
//   the SAFE behaviour: 403 for the symlink escape, generic 500 for a build error.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createDevServer } from "../src/server.ts";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..", ".."); // packages/dev/test → repo root
const req = (p: string): Request => new Request("http://localhost" + p, { headers: { host: "localhost" } });

test("L4: a symlink inside the repo pointing outside is refused (403, not served)", async () => {
  const ext = mkdtempSync(join(tmpdir(), "dxjs-l4-ext-")); // OUTSIDE the repo
  const inRepo = mkdtempSync(join(REPO_ROOT, "dxjs-l4-link-")); // INSIDE the repo
  const app = mkdtempSync(join(tmpdir(), "dxjs-l4-app-"));
  try {
    writeFileSync(join(ext, "secret.ts"), "export const STOLEN = 'outside-repo';\n");
    const link = join(inRepo, "evil.ts");
    symlinkSync(join(ext, "secret.ts"), link); // in-repo path → external target
    writeFileSync(join(app, "entry.ts"), "export {}\n");
    const server = createDevServer({ entry: join(app, "entry.ts"), root: app });

    const res = await server.handler(req("/@fs" + link));
    const body = await res.text();
    assert.equal(res.status, 403, `symlink escape must be 403, got ${res.status}`);
    assert.ok(!body.includes("outside-repo"), "the external target's content must never be served");
  } finally {
    rmSync(ext, { recursive: true, force: true });
    rmSync(inRepo, { recursive: true, force: true });
    rmSync(app, { recursive: true, force: true });
  }
});

test("L4: a transform error returns a generic 500 (no raw esbuild source echoed)", async () => {
  const inRepo = mkdtempSync(join(REPO_ROOT, "dxjs-l4-bad-"));
  const app = mkdtempSync(join(tmpdir(), "dxjs-l4-app2-"));
  try {
    const marker = "THIS_SOURCE_MUST_NOT_LEAK";
    writeFileSync(join(inRepo, "bad.ts"), `const ${marker} = = = ;\n`); // syntax error
    writeFileSync(join(app, "entry.ts"), "export {}\n");
    const server = createDevServer({ entry: join(app, "entry.ts"), root: app });

    const res = await server.handler(req("/@fs" + join(inRepo, "bad.ts")));
    const body = await res.text();
    assert.equal(res.status, 500);
    assert.ok(!body.includes(marker), `the esbuild error (with source) must not be echoed — got: ${body}`);
  } finally {
    rmSync(inRepo, { recursive: true, force: true });
    rmSync(app, { recursive: true, force: true });
  }
});
