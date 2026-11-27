// Bundle the app with esbuild → dist/, next to index.html and the stylesheets.
//   node build.mjs           one build
//   node build.mjs --watch   rebuild on every save
import { context } from "esbuild";
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("dist", { recursive: true });
for (const [from, to] of [
  ["index.html", "dist/index.html"],
  ["src/app.css", "dist/app.css"],
  ["node_modules/@dxjs/ui/ui.css", "dist/ui.css"],
]) copyFileSync(from, to);

const ctx = await context({
  entryPoints: ["src/app.ts"],
  outfile: "dist/app.js",
  bundle: true,
  format: "esm",
  minify: true,
  target: "es2021",
});
if (process.argv.includes("--watch")) {
  await ctx.watch();
  console.log("watching src/ → dist/app.js");
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log("built dist/app.js");
}
