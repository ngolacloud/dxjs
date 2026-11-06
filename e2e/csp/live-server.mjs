// Static file server (strict CSP) + a real multiplexed SSE endpoint, for the
// real-time browser proof. ONE /events stream carries every topic; /push emits a
// delta to all connected clients (push-only — no polling, no idle load); /stats
// reports the number of open SSE connections (to prove multiplexing: 2 topics,
// 1 connection).
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { join, extname } from "node:path";

const DIR = new URL(".", import.meta.url).pathname;
const CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8" };

export function start(port = 0) {
  const clients = new Set();
  const server = createServer((req, res) => {
    const url = new URL(req.url || "/", "http://local");
    const path = url.pathname;

    if (path === "/events") {
      res.writeHead(200, {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      res.write(":ok\n\n"); // comment frame to open the stream
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }
    if (path === "/push") {
      const topic = url.searchParams.get("topic") || "msg";
      const raw = url.searchParams.get("value") ?? "";
      const num = Number(raw);
      const data = JSON.stringify(raw !== "" && !Number.isNaN(num) ? num : raw);
      for (const c of clients) c.write(`event: ${topic}\ndata: ${data}\n\n`);
      res.writeHead(200, { "content-type": "application/json" });
      res.end('{"ok":true}');
      return;
    }
    if (path === "/stats") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ connections: clients.size }));
      return;
    }

    const file = path === "/" ? "/live.html" : path;
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
      const close = () => {
        for (const c of clients) c.end();
        clients.clear();
        server.close();
      };
      resolve({ server, close, port: typeof addr === "object" && addr ? addr.port : port });
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { port } = await start(8124);
  console.log(`dxjs live demo on http://127.0.0.1:${port}/  (POST-free push via /push?topic=ticker&value=42)`);
}
