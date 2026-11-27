// Serve the built ui-gallery under a strict CSP (default-src 'none'; script-src
// 'self'; style-src 'self') — the same contract as every dxjs proof. `img-src`
// and `media-src` also allow `data:` so the gallery's inline sample SVG images
// and video posters render without any network fetch. Open the printed URL.
//   node examples/ui-gallery/build.mjs
//   node examples/ui-gallery/serve.mjs            # → http://127.0.0.1:8080
//   node examples/ui-gallery/serve.mjs 9000       # pick a port
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";

const DIST = new URL("./dist/", import.meta.url).pathname;
const WANT = Number(process.argv[2] ?? process.env.DX_PORT ?? 8080);
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; media-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

const server = createServer((req, res) => {
  const path = req.url === "/" || !req.url ? "/index.html" : req.url.split("?")[0];
  try {
    const body = readFileSync(join(DIST, path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] || "application/octet-stream", "content-security-policy": CSP });
    res.end(body);
  } catch {
    res.writeHead(404, { "content-security-policy": CSP });
    res.end("not found — did you run build.mjs?");
  }
});

server.once("listening", () =>
  console.log(`ui-gallery on http://127.0.0.1:${server.address().port}/  (strict CSP)`),
);
server.once("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.warn(`port ${WANT} is in use — falling back to a free port…`);
    server.listen(0, "127.0.0.1");
  } else {
    throw err;
  }
});
server.listen(WANT, "127.0.0.1");
