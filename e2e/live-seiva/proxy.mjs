// Same-origin proxy for the live Seiva integration: serves the dxjs console
// (index.html + app.js) under a strict CSP, and forwards API paths to the real
// Seiva admin-e2e backend — so the browser talks to ONE origin (no CORS) while
// the dxjs console drives the real contract + real auth.
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";

const DIR = new URL(".", import.meta.url).pathname;
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };
const PROXIED = (p) => p.startsWith("/admin") || p === "/openapi.json" || p.startsWith("/v1");

export function start(backendBase, port = 0) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://local");
    const path = url.pathname + url.search;

    if (PROXIED(url.pathname)) {
      const chunks = [];
      for await (const c of req) chunks.push(c);
      const headers = {};
      for (const [k, v] of Object.entries(req.headers)) {
        if (["host", "connection", "content-length"].includes(k)) continue;
        headers[k] = v;
      }
      const init = { method: req.method, headers };
      if (req.method !== "GET" && req.method !== "HEAD" && chunks.length) init.body = Buffer.concat(chunks);
      try {
        const r = await fetch(backendBase + path, init);
        const buf = Buffer.from(await r.arrayBuffer());
        res.writeHead(r.status, { "content-type": r.headers.get("content-type") || "application/octet-stream" });
        res.end(buf);
      } catch (e) {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end("proxy error: " + e);
      }
      return;
    }

    const file = url.pathname === "/" ? "/index.html" : url.pathname;
    try {
      const body = readFileSync(join(DIR, file));
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "content-security-policy": CSP });
      res.end(body);
    } catch {
      res.writeHead(404, { "content-security-policy": CSP });
      res.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const addr = server.address();
      resolve({ server, close: () => server.close(), port: typeof addr === "object" && addr ? addr.port : port });
    });
  });
}
