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

// CDN / vanilla bundles: single-file ESM for direct browser use WITHOUT a bundler
// (open an .html, no build). Fully bundled (no externals). Copied into e2e/csp so
// the vanilla proof can import them same-origin under the strict CSP.
mkdirSync(join(ROOT, "cdn"), { recursive: true });
for (const [entry, out] of [
  ["cdn/dxjs.entry.ts", "cdn/dxjs.js"],
  ["cdn/dxjs-charts.entry.ts", "cdn/dxjs-charts.js"],
]) {
  await build({ ...common, entryPoints: [join(ROOT, entry)], outfile: join(ROOT, out) });
  console.log(`built ${out}`);
}
copyFileSync(join(ROOT, "cdn/dxjs.js"), join(ROOT, "e2e/csp/dxjs.js"));
copyFileSync(join(ROOT, "packages/ui/ui.css"), join(ROOT, "cdn/dxjs.css"));

// The strict-CSP demo apps, fully bundled (no externals) for the browser proofs.
// The @dxjs/ui stylesheet, served same-origin by the demo (style-src 'self').
copyFileSync(join(ROOT, "packages/ui/ui.css"), join(ROOT, "e2e/csp/dash.css"));
console.log("copied @dxjs/ui ui.css → e2e/csp/dash.css");
// The @dxjs/charts stylesheet, served same-origin by the charts demo.
copyFileSync(join(ROOT, "packages/charts/charts.css"), join(ROOT, "e2e/csp/chart.css"));
console.log("copied @dxjs/charts charts.css → e2e/csp/chart.css");

for (const name of ["app", "canvas.app", "live.app", "dash.app", "chart.app"]) {
  await build({
    ...common,
    entryPoints: [join(ROOT, `e2e/csp/${name}.ts`)],
    outfile: join(ROOT, `e2e/csp/${name}.js`),
  });
  console.log(`built e2e/csp/${name}.js`);
}
