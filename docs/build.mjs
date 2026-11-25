// Build the dxjs docs site (a dxjs app) → docs/dist/. esbuild bundles the app
// (all @dxjs/* inlined, minified ESM); the stylesheets are copied same-origin so
// the site runs under a strict CSP (style-src 'self', no inline styles).
import { build } from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const DIST = join(ROOT, "docs/dist");
mkdirSync(DIST, { recursive: true });

await build({
  entryPoints: [join(ROOT, "docs/src/app.ts")],
  outfile: join(DIST, "docs.app.js"),
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  target: "es2021",
  legalComments: "none",
  // Resolve @dxjs/* to their TS source (the `development` export condition)
  // instead of ./dist/index.js — so the docs build is self-contained and works
  // from a fresh checkout (e.g. GitHub Pages CI) without first building packages.
  conditions: ["development"],
});
console.log("built docs/dist/docs.app.js");

for (const [src, name] of [
  ["docs/index.html", "index.html"],
  // Self-contained light-theme transport guide (its own inline styles) → /transport.html.
  ["docs/transport.html", "transport.html"],
  ["docs/docs.css", "docs.css"],
  ["packages/ui/ui.css", "ui.css"],
  ["packages/charts/charts.css", "charts.css"],
]) {
  copyFileSync(join(ROOT, src), join(DIST, name));
}
console.log("copied index.html + stylesheets → docs/dist/");
