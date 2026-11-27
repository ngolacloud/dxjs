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
inject("dx:project", renderProject());
// The install line points at the GitHub Release of the version being built.
const version = JSON.parse(readFileSync(join(ROOT, "packages/core/package.json"), "utf8")).version;
page = page.replaceAll("__DXJS_VERSION__", version);
inject("dx:components-js", `<script>${compJs}</script>`);
writeFileSync(join(DIST, "transport.html"), page);
console.log(`built docs/dist/transport.html (${(page.length / 1024).toFixed(0)} KB, component bundle ${(compJs.length / 1024).toFixed(0)} KB)`);

/** The "Full project" section: examples/tarefas rendered as an architecture
 *  sketch, run steps and a file explorer. Read from disk at build time, so the
 *  guide always shows the code that is in the repository (and was run). */
function renderProject() {
  const EX = join(ROOT, "examples/tarefas");
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const code = (fname, text) =>
    `<figure class="code"><figcaption><span class="fname">${esc(fname)}</span><button class="copy">Copy</button></figcaption><pre><code>${esc(text)}</code></pre></figure>`;
  // [kind, path, depth] — the tree, in reading order.
  const tree = [
    ["file", "README.md", 0],
    ["dir", "server/", 0],
    ["file", "server/server.js", 1],
    ["file", "server/package.json", 1],
    ["dir", "web/", 0],
    ["file", "web/package.json", 1],
    ["file", "web/build.mjs", 1],
    ["file", "web/index.html", 1],
    ["dir", "web/src/", 1],
    ["file", "web/src/api.ts", 2],
    ["file", "web/src/app.ts", 2],
    ["file", "web/src/app.css", 2],
  ];
  const slug = (p) => p.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  const files = tree.filter(([k]) => k === "file");
  const first = files[0][1];
  const buttons = tree
    .map(([kind, path, depth]) => {
      const name = path.replace(/\/$/, "").split("/").pop() + (kind === "dir" ? "/" : "");
      if (kind === "dir") return `<span class="dir${depth ? ` d${depth}` : ""}">${esc(name)}</span>`;
      const on = path === first;
      return `<button role="tab" class="d${depth}" id="pf-${slug(path)}" aria-controls="pp-${slug(path)}" aria-selected="${on}"${on ? "" : ' tabindex="-1"'}>${esc(name)}</button>`;
    })
    .join("");
  const panels = files
    .map(([, path]) => {
      const text = readFileSync(join(EX, path), "utf8").replace(/\s+$/, "");
      return `<div role="tabpanel" id="pp-${slug(path)}" aria-labelledby="pf-${slug(path)}"${path === first ? "" : " hidden"}>${code(`tarefas/${path}`, text)}</div>`;
    })
    .join("");
  const step = (n, title, text, body) =>
    `<div class="step"><div class="sn">${n}</div><div><h3>${title}</h3><p>${text}</p>${body}</div></div>`;
  return `<section class="doc" id="project">
      <p class="eyebrow">Full project · examples/tarefas</p>
      <h2>From backend to frontend: a live task list</h2>
      <p class="sub">A complete project you can run: a Node.js server with zero dependencies (REST API, SSE feed, and the built web app on one origin under a strict CSP) and a dxjs web app built with <code>@dxjs/ui</code>. Open it in two tabs: create or tick a task in one and the other updates live.</p>
      <div class="arch">
        <div class="arch-box web"><h3>web/ · dxjs</h3><p>The four operations described once (<code>src/api.ts</code>); one client that calls over REST and receives the list over SSE; the interface from <code>@dxjs/ui</code>.</p></div>
        <div class="arch-wire" aria-hidden="true"><span>call → REST</span><span class="live">← live · SSE</span></div>
        <div class="arch-box srv"><h3>server/ · Node.js</h3><p>Node.js, zero dependencies: the REST routes, the SSE feed that pushes the whole list on every change, and the static web app — one origin, strict CSP.</p></div>
      </div>
      <div class="steps">
        ${step(1, "Install and build the web app", "The <code>@dxjs/*</code> packages come from the GitHub Release (see <code>web/package.json</code>). <code>npm run watch</code> rebuilds on every save.", code("terminal", "cd examples/tarefas/web\nnpm install\nnpm run build"))}
        ${step(2, "Start the server", "It serves the API, the live feed and the app on port 8000.", code("terminal", "cd ../server\nnpm start"))}
        ${step(3, "Open it in two tabs", "Add a task in one tab and tick it in the other: both update at once, over the SSE feed.", `<div class="term"><span class="pr">$</span> npm start<br /><span class="dim">Tarefas →</span> <span class="url">http://127.0.0.1:8000</span></div>`)}
      </div>
      <div class="proj" data-tabs>
        <div class="proj-tree" role="tablist" aria-label="examples/tarefas" aria-orientation="vertical">${buttons}</div>
        <div class="proj-files">${panels}</div>
      </div>
      <div class="wire"><span class="arrow">→</span><span>Swap the backend: the web app only needs the four routes in <code>server/server.js</code>, on the same origin. Any of the seven languages in the REST and SSE sections above can serve them without changing a line in <code>web/</code>.</span></div>
    </section>`;
}
