// Happy-dom probe for docs/dist/components.html — the self-contained components
// guide. The Playwright suite (docs.test.mjs) does NOT load the standalone .html
// pages, so this is the gate that proves the hash router is wired: every expected
// component has its own `#/<route>` section, the sidebar/overview have no orphan
// `#/` anchors, and every component page ships a copyable code block.
//
// Run: node docs/test/verify-components.mjs  (after `npm run docs:build`).
//
// Notes: happy-dom is imported by absolute path from node_modules; its DOM query
// results are cross-realm, so lengths/membership are read via a real-array spread
// (`[...x]`), never deepStrictEqual.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { Window } from "../../node_modules/happy-dom/lib/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FILE = join(__dirname, "../dist/components.html");

// The 18 component pages the guide must expose (overview + guide are extra
// routes on top of these). Thresholds track this list: ≥18 routes, ≥18 copies.
const COMPONENTS = [
  "button", "select", "input", "switch", "radio", "badge",
  "card", "tabs", "appShell",
  "modal", "tooltip",
  "alert", "progress", "skeleton", "spinner", "emptyState",
  "dataTable", "statCard",
];
const MIN_ROUTES = 18;
const MIN_COPIES = 18;

const html = readFileSync(FILE, "utf8");
const window = new Window();
window.document.write(html);
await window.happyDOM.waitUntilComplete();

const probe = window.__dxComponents;
const fail = [];

if (!probe) {
  fail.push("window.__dxComponents was not set — the page script did not run.");
} else {
  const routes = [...probe.routes];
  const orphans = [...probe.orphans];

  // 1. every expected component has its own route
  const missing = COMPONENTS.filter((c) => !routes.includes(c));
  if (missing.length) fail.push(`missing component routes: ${missing.join(", ")}`);

  // 2. total route count threshold
  if (routes.length < MIN_ROUTES) {
    fail.push(`only ${routes.length} routes (need ≥ ${MIN_ROUTES})`);
  }

  // 3. no orphan #/ anchors (a sidebar/overview link with no matching section)
  if (orphans.length) fail.push(`orphan anchors: ${orphans.join(", ")}`);
}

// 4. every component page ships a copyable code block
const copies = [...window.document.querySelectorAll(".copy")].length;
if (copies < MIN_COPIES) {
  fail.push(`only ${copies} copy blocks (need ≥ ${MIN_COPIES})`);
}

await window.happyDOM.close();

if (fail.length) {
  console.error("verify-components: FAIL");
  for (const f of fail) console.error("  ✗ " + f);
  process.exit(1);
}

const routeCount = probe ? [...probe.routes].length : 0;
console.log(`verify-components: PASS — ${routeCount} routes, 0 orphans, ${copies} copy blocks`);
console.log("  components: " + COMPONENTS.join(", "));
