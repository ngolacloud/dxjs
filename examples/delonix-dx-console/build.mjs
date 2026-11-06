// Build the delonix-dx-console proof of concept → dist/. esbuild bundles the dxjs
// app (all @dxjs/* + chart.js inlined, minified ESM); the stylesheets are copied
// same-origin so it runs under a strict CSP (style-src 'self', no inline styles).
import { build } from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const HERE = new URL(".", import.meta.url).pathname;
const ROOT = new URL("../../", import.meta.url).pathname;
const DIST = join(HERE, "dist");
mkdirSync(DIST, { recursive: true });

await build({
  entryPoints: [join(HERE, "src/app.ts")],
  outfile: join(DIST, "console.app.js"),
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  target: "es2021",
  legalComments: "none",
});
console.log("built dist/console.app.js");

for (const [src, name] of [
  [join(HERE, "index.html"), "index.html"],
  [join(HERE, "console.css"), "console.css"],
  [join(ROOT, "packages/ui/ui.css"), "ui.css"],
  [join(ROOT, "packages/charts/charts.css"), "charts.css"],
]) {
  copyFileSync(src, join(DIST, name));
}
console.log("copied index.html + stylesheets → dist/");
