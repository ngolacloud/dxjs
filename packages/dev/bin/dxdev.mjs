#!/usr/bin/env node
// dxdev — launch the dxjs dev server (CSP-safe HMR) for an entry module.
//
//   node --conditions=development packages/dev/bin/dxdev.mjs <entry.ts> \
//        [--port N] [--host H] [--root DIR] [--css a.css,b.css] [--title T]
//
// `--conditions=development` makes @dxjs/* resolve to source in this process;
// the server independently transpiles the app's modules to source too.
import { resolve, dirname } from "node:path";
import { createDevServer } from "../src/server.ts";

function parse(argv) {
  const args = { css: [] };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--port") args.port = Number(argv[++i]);
    else if (a === "--host") args.host = argv[++i];
    else if (a === "--root") args.root = argv[++i];
    else if (a === "--title") args.title = argv[++i];
    else if (a === "--css") args.css = String(argv[++i]).split(",").filter(Boolean);
    else rest.push(a);
  }
  args.entry = rest[0];
  return args;
}

const opts = parse(process.argv.slice(2));
if (!opts.entry) {
  console.error("usage: dxdev <entry.ts> [--port N] [--host H] [--root DIR] [--css a.css,b.css] [--title T]");
  process.exit(2);
}
const entry = resolve(opts.entry);
const root = opts.root ? resolve(opts.root) : dirname(dirname(entry)); // entry is usually <root>/src/x.ts

const server = createDevServer({
  entry,
  root,
  css: opts.css,
  title: opts.title,
  port: opts.port ?? 5173,
  host: opts.host,
});

const port = await server.listen();
console.log(`dxjs dev server → http://${opts.host ?? "127.0.0.1"}:${port}/  (strict CSP, HMR)`);

for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    server.close().finally(() => process.exit(0));
  });
}
