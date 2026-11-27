// Tarefas — the server: a REST API, a live SSE feed, and the built web app,
// all on one origin (so the page runs under a strict CSP). Node.js, zero deps.
//   GET  /v1/tasks              → all tasks
//   POST /v1/tasks              → create { title }
//   POST /v1/tasks/:id/toggle   → flip done
//   GET  /v1/tasks/stream       → text/event-stream: the full list on every change
//   GET  /*                     → ../web/dist (index.html, app.js, *.css)
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const WEB = new URL("../web/dist/", import.meta.url).pathname;
const CSP = "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:";
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css" };

let tasks = [
  { id: "1", title: "Ligar o frontend ao backend", done: true },
  { id: "2", title: "Mostrar as tarefas ao vivo", done: false },
];
let nextId = 3;
const watchers = new Set(); // open SSE responses

const json = (res, status, body) =>
  res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
const broadcast = () => {
  const frame = `data: ${JSON.stringify(tasks)}\n\n`;
  for (const w of watchers) w.write(frame);
};
const readJson = (req) =>
  new Promise((resolve) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); } catch { resolve({}); }
    });
  });

createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");

  if (req.method === "GET" && pathname === "/v1/tasks") return json(res, 200, tasks);

  if (req.method === "GET" && pathname === "/v1/tasks/stream") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
    res.write(`data: ${JSON.stringify(tasks)}\n\n`); // the current list first
    watchers.add(res);
    return req.on("close", () => watchers.delete(res));
  }

  if (req.method === "POST" && pathname === "/v1/tasks") {
    const { title } = await readJson(req);
    if (!title || !String(title).trim()) return json(res, 422, { title: "title is required" });
    const task = { id: String(nextId++), title: String(title).trim(), done: false };
    tasks = [...tasks, task];
    broadcast();
    return json(res, 201, task);
  }

  const toggle = pathname.match(/^\/v1\/tasks\/([^/]+)\/toggle$/);
  if (req.method === "POST" && toggle) {
    const task = tasks.find((t) => t.id === toggle[1]);
    if (!task) return json(res, 404, { title: "no such task" });
    tasks = tasks.map((t) => (t === task ? { ...t, done: !t.done } : t));
    broadcast();
    return json(res, 200, tasks.find((t) => t.id === task.id));
  }

  if (req.method === "GET") {
    // The web app: dist files only, never a path that climbs out of it.
    const file = normalize(join(WEB, pathname === "/" ? "index.html" : pathname));
    if (file.startsWith(WEB)) {
      try {
        const body = await readFile(file);
        return res.writeHead(200, {
          "content-type": TYPES[extname(file)] ?? "application/octet-stream",
          "content-security-policy": CSP,
        }).end(body);
      } catch {}
    }
  }
  json(res, 404, { title: "not found" });
}).listen(8000, () => console.log("Tarefas → http://127.0.0.1:8000"));
