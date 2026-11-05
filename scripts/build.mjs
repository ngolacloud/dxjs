// build — esbuild → minified ESM. Per-package dist (cross @dxjs deps external),
// plus the single bundle the strict-CSP browser proof (e2e/csp) loads.
import { build } from "esbuild";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const common = { bundle: true, minify: true, format: "esm", platform: "browser", target: "es2021", legalComments: "none" };

const PKGS = ["core", "dom", "component"];
for (const p of PKGS) {
  const out = join(ROOT, "packages", p, "dist");
  mkdirSync(out, { recursive: true });
  await build({
    ...common,
    entryPoints: [join(ROOT, "packages", p, "src/index.ts")],
    outfile: join(out, "index.js"),
    external: ["@dxjs/*"],
  });
  console.log(`built @dxjs/${p} → dist/index.js`);
}

// The strict-CSP demo app, fully bundled (no externals) for the browser proof.
await build({
  ...common,
  entryPoints: [join(ROOT, "e2e/csp/app.ts")],
  outfile: join(ROOT, "e2e/csp/app.js"),
});
console.log("built e2e/csp/app.js");
