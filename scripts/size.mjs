// size gate — REAL minified+gzipped bundle size per package, via esbuild.
//
// Each package entry is bundled with @dxjs/* marked external (so a package is
// measured on its own code, not its workspace deps), minified, and gzipped.
// Falls back to a provisional type-strip estimate only if esbuild is absent.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = new URL("..", import.meta.url).pathname;

const BUDGETS = [
  { name: "@dxjs/core", entry: "packages/core/src/index.ts", budget: 2048 },
  { name: "@dxjs/dom", entry: "packages/dom/src/index.ts", budget: 3072 },
  { name: "@dxjs/jsx", entry: "packages/jsx/src/index.ts", budget: 1024 },
  { name: "@dxjs/component", entry: "packages/component/src/index.ts", budget: 2560 },
  { name: "@dxjs/server", entry: "packages/server/src/index.ts", budget: 2560 },
  { name: "@dxjs/transport", entry: "packages/transport/src/index.ts", budget: 3072 },
  { name: "@dxjs/canvas", entry: "packages/canvas/src/index.ts", budget: 3072 },
  { name: "@dxjs/edge", entry: "packages/edge/src/index.ts", budget: 3072 },
  { name: "@dxjs/ui", entry: "packages/ui/src/index.ts", budget: 5120 },
  { name: "@dxjs/query", entry: "packages/query/src/index.ts", budget: 2048 },
  { name: "@dxjs/forms", entry: "packages/forms/src/index.ts", budget: 2048 },
];

async function sizeWithEsbuild(esbuild, entry) {
  const res = await esbuild.build({
    entryPoints: [join(ROOT, entry)],
    bundle: true,
    minify: true,
    format: "esm",
    platform: "browser",
    target: "es2021",
    external: ["@dxjs/*", "node:*"],
    write: false,
    legalComments: "none",
  });
  return gzipSync(Buffer.from(res.outputFiles[0].text)).length;
}

function provisional(entryDir) {
  let src = "";
  const dir = join(ROOT, entryDir);
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) continue;
    if (/\.ts$/.test(n)) src += readFileSync(p, "utf8");
  }
  const min = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/[ \t]+/g, " ");
  return gzipSync(Buffer.from(min)).length;
}

let esbuild = null;
try {
  esbuild = await import("esbuild");
} catch {
  /* fallback */
}

let failed = 0;
for (const { name, entry, budget } of BUDGETS) {
  let gz;
  let label;
  if (esbuild) {
    gz = await sizeWithEsbuild(esbuild, entry);
    label = "real (esbuild bundle + minify + gzip)";
  } else {
    gz = provisional(entry.replace(/\/index\.ts$/, ""));
    label = "PROVISIONAL (no esbuild)";
  }
  const ok = gz <= budget;
  console.log(`${ok ? "✓" : "✗"} ${name}: ${gz} B gzip / budget ${budget} B  [${label}]`);
  if (!ok) failed++;
}

if (failed) {
  console.error(`\nsize gate FAILED: ${failed} package(s) over budget.`);
  process.exit(1);
}
console.log("size gate PASSED.");

// @dxjs/charts is EXEMPT from the budget gate: it carries a runtime dependency
// (chart.js), a deliberate trade for a mature charting engine. We still MEASURE it
// (chart.js bundled in) so a regression is visible — it just never fails the gate.
if (esbuild) {
  try {
    const res = await esbuild.build({
      entryPoints: [join(ROOT, "packages/charts/src/index.ts")],
      bundle: true,
      minify: true,
      format: "esm",
      target: "es2021",
      external: ["@dxjs/*", "node:*"], // chart.js IS bundled → real shipped size
      write: false,
    });
    const gz = gzipSync(res.outputFiles[0].contents).length;
    console.log(`ℹ @dxjs/charts: ${gz} B gzip (chart.js bundled; exempt from the size budget)`);
  } catch {
    /* informational only */
  }
}
