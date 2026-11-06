// A tiny static server that serves the dxjs demo under a STRICT CSP:
//   default-src 'none'; script-src 'self'; ... — no unsafe-eval, no unsafe-inline.
// If dxjs tried to eval or use inline handlers, the browser would block it.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";

const DIR = new URL(".", import.meta.url).pathname;
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
};

export function start(port = 0) {
  const server = createServer((req, res) => {
    const path = req.url === "/" || !req.url ? "/index.html" : req.url.split("?")[0];
    try {
      const body = readFileSync(join(DIR, path));
      res.writeHead(200, {
        "content-type": TYPES[extname(path)] || "application/octet-stream",
        "content-security-policy": CSP,
      });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-security-policy": CSP });
      res.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, port: typeof addr === "object" && addr ? addr.port : port });
    });
  });
}

// Allow `node server.mjs` for manual inspection.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = await start(8123);
  console.log(`dxjs CSP demo on http://127.0.0.1:${port}/`);
}
