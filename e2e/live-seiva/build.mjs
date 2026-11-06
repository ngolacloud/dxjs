// Bundle the live-seiva demo app (not part of the main build — this proof needs
// a running Seiva Rust backend, so it is local/on-demand, not CI).
import { build } from "esbuild";
const ROOT = new URL("../..", import.meta.url).pathname;
await build({
  entryPoints: [new URL("./app.ts", import.meta.url).pathname],
  outfile: new URL("./app.js", import.meta.url).pathname,
  bundle: true,
  minify: true,
  format: "esm",
  platform: "browser",
  target: "es2021",
  legalComments: "none",
  absWorkingDir: ROOT,
});
console.log("built e2e/live-seiva/app.js");
