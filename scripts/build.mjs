// build — per-package publishable artifacts + the vanilla/CSP bundles.
//
// For every @dxjs/* package we emit TWO things into its dist/:
//   • dist/index.js    — minified ESM runtime, via esbuild (its own code only;
//                        @dxjs/*, node:* and declared peers stay external).
//   • dist/index.d.ts  — type declarations, via `tsc --emitDeclarationOnly`.
// so a consumer gets "Node + static typing" (exports.types → dist/index.d.ts,
// default → dist/index.js) without ever shipping raw .ts. The intra-repo dev
// path (tests, examples) still runs the TS source directly through the
// `development` export condition (see each package.json) — no build needed.
//
// Packages are built in DEPENDENCY ORDER so that when tsc emits a package's
// declarations, every @dxjs dependency already exposes its dist/index.d.ts.
import { build } from "esbuild";
import { mkdirSync, copyFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = new URL("..", import.meta.url).pathname;
const common = { bundle: true, minify: true, format: "esm", platform: "browser", target: "es2021", legalComments: "none" };

// Resolve a tsc: prefer the pinned workspace copy, fall back to one on PATH.
const localTsc = join(ROOT, "node_modules/.bin/tsc");
const TSC = existsSync(localTsc) ? localTsc : "tsc";

// Dependency-ordered: a package's @dxjs deps (and so their emitted .d.ts) come first.
const PKGS = [
  { name: "core" },
  { name: "i18n" }, // deps: core
  { name: "dom" },
  { name: "devtools" }, // deps: core, dom — MUST come after dom (its .d.ts is needed)
  // jsx ships three entry points (barrel + the two JSX runtimes the transform imports).
  { name: "jsx", entries: ["index", "jsx-runtime", "jsx-dev-runtime"] },
  { name: "component" },
  { name: "terminal" }, // deps: core, dom
  { name: "server" },
  { name: "transport" },
  { name: "edge", platform: "node" }, // node:http2 / node:http — server/edge runtimes only
  { name: "dev", platform: "node", external: ["esbuild"] }, // node tool: node:* + esbuild peer
  { name: "query" },
  { name: "forms" },
  { name: "openapi" }, // deps: transport — after transport (its .d.ts is needed)
  { name: "soap" }, // deps: transport
  { name: "proto" }, // deps: transport
  { name: "seiva" }, // deps: core, transport, query — after all three
  { name: "canvas" },
  { name: "shell" }, // deps: core, dom, canvas
  { name: "ui" },
  { name: "logs" }, // deps: core, dom, ui
  { name: "k8s" }, // deps: core, dom, ui
  { name: "charts", external: ["chart.js"] }, // chart.js is a runtime peer, not bundled into dist
];

for (const { name, platform, external = [], entries = ["index"] } of PKGS) {
  const dir = join(ROOT, "packages", name);
  mkdirSync(join(dir, "dist"), { recursive: true });
  // 1) runtime JS — bundle this package's own code; keep deps/peers external.
  //    A package may expose several entry points (e.g. jsx's two runtimes).
  for (const e of entries) {
    await build({
      ...common,
      ...(platform ? { platform } : {}),
      entryPoints: [join(dir, `src/${e}.ts`)],
      outfile: join(dir, `dist/${e}.js`),
      external: ["@dxjs/*", "node:*", ...external],
    });
  }
  // 2) type declarations — emitted here, in dependency order.
  execFileSync(TSC, ["-p", join(dir, "tsconfig.json")], { cwd: ROOT, stdio: "inherit" });
  console.log(`built @dxjs/${name} → ${entries.map((e) => `dist/${e}.js`).join(" + ")} + .d.ts`);
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
