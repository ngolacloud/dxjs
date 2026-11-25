// @dxjs/dev server — a CSP-safe development server with HMR, built ON TOP of the
// @dxjs/edge Web-fetch handler (`createEdgeHandler`/`htmlResponse`/`nodeListener`).
// It runs only in development (it is a Node tool); the product runtime keeps NO
// Node dependency — the browser just loads same-origin ES modules.
//
// How it works:
//   • Each requested module is transpiled on demand with esbuild (TS/TSX → ESM,
//     automatic JSX → @dxjs/jsx) and its imports are EXTERNALISED to `/@fs…`
//     URLs, so the browser loads a real module graph (no bundle) — the grain HMR
//     needs. Dependency URLs carry a per-file version, so editing one module does
//     NOT bust its dependencies' URLs (the cached @dxjs/core instance is reused).
//   • A long-poll channel (`/@dx/hmr`) tells the browser which module changed;
//     the injected client re-imports just that module. Long-poll is plain
//     `fetch`, so it needs only `connect-src 'self'` — no WebSocket, no SSE.
//   • Everything is served under a STRICT CSP (`script-src/style-src 'self'`,
//     no `unsafe-eval`, no `unsafe-inline`): module scripts and dynamic
//     `import()` are same-origin; there is not one inline script or handler.

import { createServer, type Server } from "node:http";
import { readFile, realpath } from "node:fs/promises";
import { watch, existsSync } from "node:fs";
import { resolve, dirname, extname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { createEdgeHandler, htmlResponse, nodeListener, type FetchHandler } from "@dxjs/edge";

/** The strict CSP every dev response carries — the same posture the product ships
 *  under. `script-src 'self'` covers module scripts AND dynamic import(); no
 *  `unsafe-eval`/`unsafe-inline` anywhere. */
export const DEV_CSP =
  "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; " +
  "img-src 'self' data:; font-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

export interface DevServerOptions {
  /** Entry module (an app's `.ts`/`.tsx`). Loaded as `<script type=module>`. */
  entry: string;
  /** App root; static assets (e.g. CSS) are served from here. Defaults to the
   *  entry's directory's parent that contains it — in practice pass it. */
  root?: string;
  /** Stylesheets (relative to `root`) linked in the generated index, served
   *  same-origin so `style-src 'self'` holds. */
  css?: string[];
  /** Document title. */
  title?: string;
  /** TCP port (0 = ephemeral). */
  port?: number;
  /** Bind host. */
  host?: string;
}

export interface DevServer {
  /** Begin listening. Resolves with the bound port. */
  listen(): Promise<number>;
  /** Stop the server and the file watcher. */
  close(): Promise<void>;
  /** The composed Web-fetch handler (exposed for tests / custom hosts). */
  readonly handler: FetchHandler;
  /** The bound port (valid after `listen`). */
  readonly port: number;
}

const HERE = dirname(fileURLToPath(import.meta.url));
// The HMR client is TypeScript source we transpile on demand. When running from
// source HERE is packages/dev/src; when running from a published dist/, HERE is
// packages/dev/dist and the source lives one level up in src/ (shipped via
// package.json "files"). Resolve whichever exists.
const CLIENT_SRC = existsSync(resolve(HERE, "client.ts"))
  ? resolve(HERE, "client.ts")
  : resolve(HERE, "..", "src", "client.ts");
// The monorepo root (…/packages/dev/src → …/). Modules may live under packages/*,
// so the `/@fs` guard allows anything inside the repo root (dev only).
const REPO_ROOT = resolve(HERE, "..", "..", "..");

const JS_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs"]);
const MIME: Record<string, string> = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function headers(extra?: Record<string, string>): Headers {
  const h = new Headers(extra);
  h.set("content-security-policy", DEV_CSP);
  return h;
}

function jsResponse(code: string): Response {
  return new Response(code, {
    status: 200,
    headers: headers({ "content-type": MIME[".js"]!, "cache-control": "no-store" }),
  });
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: headers({ "content-type": MIME[".json"]!, "cache-control": "no-store" }),
  });
}

/** Marks a nested `build.resolve` call so the plugin's own `onResolve` lets
 *  esbuild resolve it normally instead of recursing forever. */
const DX_RESOLVE_SKIP = Symbol("dx-resolve-skip");

export function createDevServer(options: DevServerOptions): DevServer {
  const entryAbs = resolve(options.entry);
  const root = resolve(options.root ?? dirname(entryAbs));
  const title = options.title ?? "dxjs dev";
  const cssLinks = (options.css ?? [])
    .map((f) => `\n  <link rel="stylesheet" href="/@app/${f}" />`)
    .join("");

  // --- versioning -----------------------------------------------------------
  // Per-file version. A module's URL is `/@fs<abs>?v=<version>`; only the edited
  // file's version changes, so its dependents' dependency URLs stay stable.
  const versions = new Map<string, number>();
  const versionOf = (abs: string): number => versions.get(abs) ?? 1;
  const served = new Set<string>(); // files that are part of the live module graph

  // --- HMR change log + long-poll waiters ----------------------------------
  let epoch = 0;
  const changeLog: Array<{ epoch: number; path: string; version: number }> = [];
  interface Waiter {
    since: number;
    resolve: (msg: { epoch: number; updates: Array<{ path: string; version: number }> } | null) => void;
    timer: ReturnType<typeof setTimeout>;
  }
  let waiters: Waiter[] = [];

  function updatesSince(since: number): Array<{ path: string; version: number }> {
    const latest = new Map<string, number>();
    for (const c of changeLog) if (c.epoch > since) latest.set(c.path, c.version);
    return [...latest].map(([path, version]) => ({ path, version }));
  }

  function flushWaiters(): void {
    const pendingW = waiters;
    waiters = [];
    for (const w of pendingW) {
      clearTimeout(w.timer);
      w.resolve({ epoch, updates: updatesSince(w.since) });
    }
  }

  function recordChanges(files: string[]): void {
    for (const abs of files) {
      versions.set(abs, versionOf(abs) + 1);
      epoch += 1;
      changeLog.push({ epoch, path: "/@fs" + abs, version: versionOf(abs) });
    }
    if (changeLog.length > 500) changeLog.splice(0, changeLog.length - 500);
    flushWaiters();
  }

  // --- file watcher (debounced) --------------------------------------------
  const pending = new Set<string>();
  let debounce: ReturnType<typeof setTimeout> | null = null;
  function onFsEvent(filename: string | null): void {
    if (!filename) return;
    const abs = resolve(root, filename);
    if (!served.has(abs)) return; // ignore files not in the live graph
    pending.add(abs);
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      debounce = null;
      const batch = [...pending];
      pending.clear();
      recordChanges(batch);
    }, 30);
  }
  let watcher: ReturnType<typeof watch> | null = null;

  // --- esbuild transform (one module, imports externalised) ----------------
  const externalize: esbuild.Plugin = {
    name: "dx-externalize",
    setup(build) {
      build.onResolve({ filter: /.*/ }, async (args) => {
        if (args.kind === "entry-point") return null;
        if (args.pluginData === DX_RESOLVE_SKIP) return null; // let esbuild resolve it
        const r = await build.resolve(args.path, {
          importer: args.importer,
          resolveDir: args.resolveDir,
          kind: args.kind,
          pluginData: DX_RESOLVE_SKIP,
        });
        if (r.errors.length) return { errors: r.errors };
        served.add(r.path);
        return { path: "/@fs" + r.path + "?v=" + versionOf(r.path), external: true };
      });
    },
  };

  async function transformModule(abs: string): Promise<string> {
    const result = await esbuild.build({
      entryPoints: [abs],
      bundle: true, // bundle so the plugin sees every import, but all are external
      write: false,
      format: "esm",
      platform: "browser",
      target: "es2021",
      jsx: "automatic",
      jsxImportSource: "@dxjs/jsx",
      conditions: ["development", "browser"],
      sourcemap: "inline",
      logLevel: "silent",
      plugins: [externalize],
    });
    served.add(abs);
    const code = result.outputFiles![0]!.text;
    // Give every dev module an `import.meta.hot`. The id (no `?v`) is stable, so
    // the client re-attaches to the SAME hot context — and thus the same `data`
    // (its signals) — on every re-import.
    const id = "/@fs" + abs;
    const banner =
      `import { createHotContext as __dxhot } from "/@dx/client.js";\n` +
      `import.meta.hot = __dxhot(${JSON.stringify(id)});\n`;
    return banner + code;
  }

  // --- static assets from the app root -------------------------------------
  async function serveStatic(relPath: string): Promise<Response> {
    const abs = resolve(root, relPath);
    // Containment by path semantics, NOT string prefix: `startsWith(root)` lets a
    // sibling that shares the prefix (root `…/app` vs `…/app-x`) escape via an
    // encoded `..`. `isWithin` compares the relative path instead.
    if (!isWithin(abs, root)) return new Response("Forbidden", { status: 403, headers: headers() });
    // Dotfiles / dot-directories (`.env`, `.git/…`) are never app assets.
    if (relative(root, abs).split(/[/\\]/).some((seg) => seg.startsWith(".")))
      return new Response("Forbidden", { status: 403, headers: headers() });
    try {
      const body = await readFile(abs);
      const ext = extname(abs);
      return new Response(body, {
        status: 200,
        headers: headers({ "content-type": MIME[ext] ?? "application/octet-stream" }),
      });
    } catch {
      return new Response("Not found", { status: 404, headers: headers() });
    }
  }

  // --- the generated index --------------------------------------------------
  function indexHtml(): string {
    return (
      `<!doctype html>\n<html lang="en">\n<head>\n` +
      `  <meta charset="utf-8" />\n` +
      `  <meta name="viewport" content="width=device-width, initial-scale=1" />\n` +
      `  <title>${title}</title>${cssLinks}\n` +
      `</head>\n<body>\n  <div id="app"></div>\n` +
      `  <script type="module" src="/@fs${entryAbs}?v=${versionOf(entryAbs)}"></script>\n` +
      `</body>\n</html>\n`
    );
  }

  // --- routing (built on @dxjs/edge) ---------------------------------------
  const exact = createEdgeHandler({
    "/": async () => htmlResponse(indexHtml(), { csp: DEV_CSP }),
    "/index.html": async () => htmlResponse(indexHtml(), { csp: DEV_CSP }),
    "/@dx/client.js": async () => {
      const result = await esbuild.build({
        entryPoints: [CLIENT_SRC],
        bundle: false,
        write: false,
        format: "esm",
        platform: "browser",
        target: "es2021",
        logLevel: "silent",
      });
      return jsResponse(result.outputFiles![0]!.text);
    },
    "/@dx/hmr": async (req) => {
      const since = Number(new URL(req.url).searchParams.get("since") ?? 0);
      if (epoch > since) return jsonResponse({ epoch, updates: updatesSince(since) });
      // Hold the connection until a change arrives or the window closes. The
      // edge handler naturally keeps the socket open while this promise is
      // pending (nodeListener awaits the Response).
      const msg = await new Promise<{ epoch: number; updates: Array<{ path: string; version: number }> } | null>(
        (res) => {
          const timer = setTimeout(() => {
            waiters = waiters.filter((w) => w.timer !== timer);
            res(null);
          }, 25_000);
          waiters.push({ since, resolve: res, timer });
        },
      );
      if (!msg) return new Response(null, { status: 204, headers: headers() });
      return jsonResponse(msg);
    },
  });

  // --- DNS-rebinding guard --------------------------------------------------
  // The dev server only ever answers for loopback; a request whose `Host` is a
  // name an attacker rebinds to 127.0.0.1 is rejected, so a foreign page can
  // never read local source / HMR state through this origin.
  const allowedHosts = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
  if (options.host) allowedHosts.add(options.host.toLowerCase());
  function hostAllowed(hostHeader: string | null): boolean {
    if (!hostHeader) return false; // HTTP/1.1 requires Host; a browser always sends it
    const h = hostHeader.trim().toLowerCase();
    // Strip the port, keeping the IPv6 bracket form (`[::1]:5173` → `[::1]`).
    const name = h.startsWith("[") ? h.slice(0, h.indexOf("]") + 1) : h.split(":", 1)[0]!;
    return allowedHosts.has(name);
  }

  const handler: FetchHandler = async (request) => {
    if (!hostAllowed(request.headers.get("host")))
      return new Response("Forbidden", { status: 403, headers: headers() });
    const url = new URL(request.url);
    const path = url.pathname;
    if (path.startsWith("/@fs/")) {
      const abs = decodeURIComponent(path.slice("/@fs".length));
      if (!isWithin(abs, REPO_ROOT) || !JS_EXT.has(extname(abs))) {
        return new Response("Forbidden", { status: 403, headers: headers() });
      }
      try {
        return jsResponse(await transformModule(abs));
      } catch (err) {
        return new Response(String((err as Error).message ?? err), {
          status: 500,
          headers: headers({ "content-type": "text/plain; charset=utf-8" }),
        });
      }
    }
    if (path.startsWith("/@app/")) {
      return serveStatic(decodeURIComponent(path.slice("/@app/".length)));
    }
    return exact(request);
  };

  let server: Server | null = null;
  let boundPort = options.port ?? 0;

  return {
    get handler() {
      return handler;
    },
    get port() {
      return boundPort;
    },
    async listen(): Promise<number> {
      // Resolve the entry to its real path so watcher events (which resolve
      // against `root`) and served ids agree.
      const entryReal = await realpath(entryAbs).catch(() => entryAbs);
      served.add(entryReal);
      watcher = watch(root, { recursive: true }, (_event, filename) =>
        onFsEvent(filename ? String(filename) : null),
      );
      server = createServer(nodeListener(handler));
      await new Promise<void>((res, rej) => {
        server!.once("error", rej);
        server!.listen(options.port ?? 0, options.host ?? "127.0.0.1", () => {
          const addr = server!.address();
          boundPort = typeof addr === "object" && addr ? addr.port : boundPort;
          res();
        });
      });
      return boundPort;
    },
    async close(): Promise<void> {
      if (debounce) clearTimeout(debounce);
      for (const w of waiters) clearTimeout(w.timer);
      waiters = [];
      watcher?.close();
      watcher = null;
      await new Promise<void>((res) => (server ? server.close(() => res()) : res()));
      server = null;
    },
  };
}

function isWithin(abs: string, root: string): boolean {
  if (!isAbsolute(abs)) return false;
  const rel = relative(root, abs);
  return !rel.startsWith("..") && !isAbsolute(rel);
}
