// Build the dxjs docs site (a dxjs app) → docs/dist/. esbuild bundles the app
// (all @dxjs/* inlined, minified ESM); the stylesheets are copied same-origin so
// the site runs under a strict CSP (style-src 'self', no inline styles).
import { build } from "esbuild";
import { mkdirSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
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
  // Self-contained components guide (static previews, hash router) → /components.html.
  ["docs/components.html", "components.html"],
  ["docs/docs.css", "docs.css"],
  ["packages/ui/ui.css", "ui.css"],
  ["packages/charts/charts.css", "charts.css"],
]) {
  copyFileSync(join(ROOT, src), join(DIST, name));
}
console.log("copied index.html + stylesheets → docs/dist/");

// Self-contained light-theme transport guide → /transport.html. It carries its own
// inline styles and script, plus the live component reference: the @dxjs/ui
// stylesheet and the component bundle (docs/src/transport-components.ts) are
// inlined at the page's two markers, so the one file works anywhere — GitHub Pages
// or a single-file host — with no other request.
const comp = await build({
  entryPoints: [join(ROOT, "docs/src/transport-components.ts")],
  bundle: true,
  minify: true,
  format: "iife",
  platform: "browser",
  target: "es2021",
  legalComments: "none",
  conditions: ["development"],
  write: false,
});
const compJs = comp.outputFiles[0].text.replace(/<\/(script)/gi, "<\\/$1");
// The guide is a committed light page, so its previews pin the kit to its light
// tokens: ui.css's dark selectors (prefers-color-scheme and data-theme="dark",
// which a host such as claude.ai sets on <html>) are disarmed in this copy only.
const uiCss = readFileSync(join(ROOT, "packages/ui/ui.css"), "utf8")
  .replace(/@media\s*\(prefers-color-scheme:\s*dark\)/g, "@media not all")
  .replace(/\[data-theme="dark"\]/g, '[data-dx-guide-never="dark"]')
  .replace(/<\/(style)/gi, "<\\/$1");
let page = readFileSync(join(ROOT, "docs/transport.html"), "utf8");
const inject = (marker, content) => {
  const re = new RegExp(`<!-- ${marker}[^>]*-->`);
  if (!re.test(page)) throw new Error(`docs/transport.html: missing <!-- ${marker} --> marker`);
  page = page.replace(re, () => content);
};
inject("dx:ui-css", `<style>${uiCss}</style>`);
inject("dx:components-js", `<script>${compJs}</script>`);
writeFileSync(join(DIST, "transport.html"), page);
console.log(`built docs/dist/transport.html (${(page.length / 1024).toFixed(0)} KB, component bundle ${(compJs.length / 1024).toFixed(0)} KB)`);
