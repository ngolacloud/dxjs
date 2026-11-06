// Vendor the dxjs Seiva console into the Rust crate `seiva-console-admin`
// (Seiva ADR 0016). Bundles examples/seiva-console/browser.ts to a single
// minified ESM module, copies the @dxjs/ui stylesheet, and records the bundle's
// SHA-256 (base64) so the crate's drift guard can pin the exact bytes served.
//
//   node scripts/vendor-seiva-console.mjs
//
// The crate reads the three files via include_str!/include_str!/served asset:
//   assets/dx.js         — the bundle (ADMIN_DX_JS, served at /admin/dx.js)
//   assets/dx.css        — @dxjs/ui ui.css (served at /admin/dx.css, style-src 'self')
//   assets/dx.js.sha256  — base64(SHA-256(dx.js)), the drift guard's recorded hash
import { build } from "esbuild";
import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const ASSETS = join(ROOT, "../seiva/crates/seiva-console-admin/assets");

const JS = join(ASSETS, "dx.js");
await build({
  entryPoints: [join(ROOT, "examples/seiva-console/browser.ts")],
  outfile: JS,
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  target: "es2021",
  legalComments: "none",
});
console.log("bundled examples/seiva-console/browser.ts → assets/dx.js");

copyFileSync(join(ROOT, "packages/ui/ui.css"), join(ASSETS, "dx.css"));
console.log("copied @dxjs/ui ui.css → assets/dx.css");

const digest = createHash("sha256").update(readFileSync(JS)).digest("base64");
writeFileSync(join(ASSETS, "dx.js.sha256"), digest + "\n");
console.log(`recorded assets/dx.js.sha256 = ${digest}`);
