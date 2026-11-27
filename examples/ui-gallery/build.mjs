// Build the ui-gallery example → dist/. esbuild bundles the app (all @dxjs/*
// inlined, minified ESM); stylesheets are copied same-origin so the gallery runs
// under a strict CSP (style-src 'self', no inline styles — same contract the kit
// itself honours).
import { build } from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const HERE = new URL(".", import.meta.url).pathname;
const ROOT = new URL("../../", import.meta.url).pathname;
const DIST = join(HERE, "dist");
mkdirSync(DIST, { recursive: true });

await build({
  entryPoints: [join(HERE, "src/main.ts")],
  outfile: join(DIST, "gallery.app.js"),
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  target: "es2021",
  // Resolve @dxjs/* to TypeScript source (esbuild compiles it) so the example
  // builds without a prior `npm run build` of every package's dist.
  conditions: ["development", "browser"],
  legalComments: "none",
});
console.log("built dist/gallery.app.js");

for (const [src, name] of [
  [join(HERE, "index.html"), "index.html"],
  [join(HERE, "gallery.css"), "gallery.css"],
  [join(ROOT, "packages/ui/ui.css"), "ui.css"],
]) {
  copyFileSync(src, join(DIST, name));
}
console.log("copied index.html + stylesheets → dist/");
