// build — esbuild → minified ESM. Per-package dist (cross @dxjs deps external),
// plus the single bundle the strict-CSP browser proof (e2e/csp) loads.
import { build } from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";
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

// The strict-CSP demo apps, fully bundled (no externals) for the browser proofs.
// The @dxjs/ui stylesheet, served same-origin by the demo (style-src 'self').
copyFileSync(join(ROOT, "packages/ui/ui.css"), join(ROOT, "e2e/csp/dash.css"));
console.log("copied @dxjs/ui ui.css → e2e/csp/dash.css");

for (const name of ["app", "canvas.app", "live.app", "dash.app"]) {
  await build({
    ...common,
    entryPoints: [join(ROOT, `e2e/csp/${name}.ts`)],
    outfile: join(ROOT, `e2e/csp/${name}.js`),
  });
  console.log(`built e2e/csp/${name}.js`);
}
