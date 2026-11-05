// no-eval gate — fails the build if any forbidden sink appears in package
// source. This is the audit's hardest lesson (SEC-001..SEC-006): dxjs must run
// under a strict CSP with no unsafe-eval / unsafe-inline.
//
// Forbidden in src/: eval(, new Function, inline on*= handlers, document.write,
// and innerHTML assignment (data must go through escaped DOM sinks).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;
const PKGS = join(ROOT, "packages");

const RULES = [
  { re: /\beval\s*\(/, msg: "eval(" },
  { re: /new\s+Function\s*\(/, msg: "new Function(" },
  { re: /\bon\w+\s*=\s*["'`]/, msg: "inline on*= handler" },
  { re: /document\s*\.\s*write\s*\(/, msg: "document.write(" },
  { re: /\.\s*innerHTML\s*=/, msg: ".innerHTML = (use escaped DOM sinks)" },
  { re: /\bsetTimeout\s*\(\s*["'`]/, msg: "setTimeout(string)" },
];

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) {
      if (name === "node_modules" || name === "dist" || name === "test") continue;
      yield* walk(p);
    } else if (/\.(ts|mjs|js)$/.test(name)) {
      yield p;
    }
  }
}

let violations = 0;
for (const file of walk(PKGS)) {
  const lines = readFileSync(file, "utf8").split("\n");
  lines.forEach((line, i) => {
    // ignore line comments so documentation of the ban does not trip the gate
    const code = line.replace(/\/\/.*$/, "");
    for (const { re, msg } of RULES) {
      if (re.test(code)) {
        console.error(`✗ ${file}:${i + 1}  forbidden: ${msg}`);
        console.error(`    ${line.trim()}`);
        violations++;
      }
    }
  });
}

if (violations) {
  console.error(`\nno-eval gate FAILED: ${violations} violation(s).`);
  process.exit(1);
}
console.log("no-eval gate PASSED: no forbidden sinks in package source.");
