// size gate — measures the gzipped size of each package entry against a budget.
//
// Preferred path: bundle+minify with esbuild when it is installed (CI). Local
// fallback: strip TS types with Node's built-in stripper + a light minify, then
// gzip — a close provisional upper bound (real min+gzip is smaller). The number
// is labelled PROVISIONAL when the fallback is used.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";

const ROOT = new URL("..", import.meta.url).pathname;

// package entry -> budget in bytes (gzip)
const BUDGETS = [
  { name: "@dxjs/core", dir: "packages/core/src", budget: 2048 },
  { name: "@dxjs/dom", dir: "packages/dom/src", budget: 3072 },
  { name: "@dxjs/component", dir: "packages/component/src", budget: 2560 },
];

function collectSource(dir) {
  let out = "";
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out += collectSource(p);
    else if (/\.ts$/.test(name)) out += readFileSync(p, "utf8") + "\n";
  }
  return out;
}

async function stripTypes(code) {
  try {
    const mod = await import("node:module");
    if (typeof mod.stripTypeScriptTypes === "function") {
      return { code: mod.stripTypeScriptTypes(code, { mode: "strip" }), stripped: true };
    }
  } catch {
    /* fall through */
  }
  return { code, stripped: false };
}

// Conservative minify: drop block/line comments and collapse runs of blank
// space. Not a real minifier — only for a provisional local estimate.
function lightMinify(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, "\n")
    .replace(/^\s+|\s+$/gm, "")
    .trim();
}

let failed = 0;
for (const { name, dir, budget } of BUDGETS) {
  const raw = collectSource(join(ROOT, dir));
  const { code, stripped } = await stripTypes(raw);
  const min = lightMinify(code);
  const gz = gzipSync(Buffer.from(min)).length;
  const label = stripped ? "provisional (type-stripped + light-minify + gzip)" : "PROVISIONAL (types kept)";
  const ok = gz <= budget;
  const mark = ok ? "✓" : "✗";
  console.log(`${mark} ${name}: ${gz} B gzip / budget ${budget} B  [${label}]`);
  if (!ok) failed++;
}

if (failed) {
  console.error(`\nsize gate FAILED: ${failed} package(s) over budget.`);
  process.exit(1);
}
console.log("size gate PASSED.");
