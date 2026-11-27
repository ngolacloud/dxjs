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
  // 3200 (was 3072): the security-audit hardening added per-sink guards to the SSR
  // string renderer and hydration — URL-scheme sanitising (H1), dropping inline on*
  // (M1) and raw-HTML .prop (M2). ~40 B gzipped, deliberately not obfuscated.
  // 3456 (was 3200): M11 streaming resilience — per-Suspense `timeout`/abort bound
  // + out-of-order `concurrency` gate, so a stuck boundary degrades to its fallback
  // instead of hanging or truncating. ~270 B gzipped, deliberately not obfuscated.
  // 3584 (was 3456): L1 raw-text scanner — detects <script>/<style> so dynamic
  // interpolation there is refused (no safe CSS/JS escaping). ~55 B gzipped.
  { name: "@dxjs/server", entry: "packages/server/src/index.ts", budget: 3584 },
  // + ADR 0001 transport port, adapters (REST/Connect/in-memory/embedded/SSE/WS),
  // composeTransport and liveSignal.
  { name: "@dxjs/transport", entry: "packages/transport/src/index.ts", budget: 5120 },
  { name: "@dxjs/canvas", entry: "packages/canvas/src/index.ts", budget: 3072 },
  { name: "@dxjs/edge", entry: "packages/edge/src/index.ts", budget: 3072 },
  // v2 kit: full control/feedback/nav/picker + advanced suite (calendar/holidays,
  // gantt, planner, map, metrics, media, rating, xlsx export, Ctrl+K search/filter).
  // Tree-shakeable (sideEffects:false) — apps pull only what they import.
  { name: "@dxjs/ui", entry: "packages/ui/src/index.ts", budget: 34816 },
  { name: "@dxjs/query", entry: "packages/query/src/index.ts", budget: 2048 },
  { name: "@dxjs/forms", entry: "packages/forms/src/index.ts", budget: 2048 },
  { name: "@dxjs/openapi", entry: "packages/openapi/src/index.ts", budget: 2048 },
  { name: "@dxjs/soap", entry: "packages/soap/src/index.ts", budget: 2048 },
  { name: "@dxjs/proto", entry: "packages/proto/src/index.ts", budget: 1536 },
  { name: "@dxjs/seiva", entry: "packages/seiva/src/index.ts", budget: 2048 },
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
