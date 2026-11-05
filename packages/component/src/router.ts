// @dxjs/component/router — a small History-API router.
//
// Matches `/users/:id` style patterns, exposes the current match as a signal,
// and swaps the mounted component in an outlet on navigation (disposing the
// previous one — no leaked effects/listeners). Routes may be lazy
// (`load: () => import(...)`) for code-splitting; Subresource Integrity for
// those chunks is applied at build/deploy time (F2), not here.
//
// Guards are UX-only: they decide what to SHOW. Authorization is always enforced
// by the backend (the StillJS audit's SEC-007 lesson) — never trust a guard.

import { signal, effect, createRoot, onCleanup, type Accessor } from "@dxjs/core";
import { mount, type Component } from "./index.ts";

export interface RouteContext {
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
}

/** A guard returns true (allow), false (block), or a path string (redirect). */
export type Guard = (ctx: RouteContext) => boolean | string;

export interface Route {
  path: string;
  /** A synchronous component… */
  component?: Component<RouteContext>;
  /** …or a lazy one for code-splitting. */
  load?: () => Promise<{ default: Component<RouteContext> }>;
  guard?: Guard;
}

export interface RouterOptions {
  /** Path to redirect to when nothing matches or a guard blocks. */
  fallback?: string;
}

export interface Router {
  /** Reactive current match (null before the first resolve or when blocked). */
  current: Accessor<Match | null>;
  navigate(to: string, opts?: { replace?: boolean }): void;
  /** Mount the matched route into `host`; returns a disposer. */
  outlet(host: Element): () => void;
  dispose(): void;
}

export interface Match {
  route: Route;
  ctx: RouteContext;
}

interface Compiled {
  route: Route;
  re: RegExp;
  names: string[];
}

function compile(pattern: string): { re: RegExp; names: string[] } {
  if (pattern === "/" || pattern === "") return { re: /^\/?$/, names: [] };
  const names: string[] = [];
  let rx = "^";
  for (const seg of pattern.split("/")) {
    if (seg === "") continue;
    rx += "/";
    if (seg.startsWith(":")) {
      names.push(seg.slice(1));
      rx += "([^/]+)";
    } else if (seg === "*") {
      names.push("rest");
      rx += "(.*)";
    } else {
      rx += seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  }
  rx += "/?$";
  return { re: new RegExp(rx), names };
}

function getLocation(): { pathname: string; search: string } {
  const loc = (globalThis as { location?: { pathname: string; search: string } }).location;
  return { pathname: loc?.pathname ?? "/", search: loc?.search ?? "" };
}

/** Create a router over the given routes. Resolves the current location eagerly. */
export function createRouter(routes: Route[], options: RouterOptions = {}): Router {
  const compiled: Compiled[] = routes.map((route) => {
    const { re, names } = compile(route.path);
    return { route, re, names };
  });
  const current = signal<Match | null>(null);

  const resolve = (): void => {
    const { pathname, search } = getLocation();
    const query = new URLSearchParams(search);
    for (const c of compiled) {
      const m = c.re.exec(pathname);
      if (!m) continue;
      const params: Record<string, string> = {};
      c.names.forEach((n, i) => {
        params[n] = decodeURIComponent(m[i + 1] ?? "");
      });
      const ctx: RouteContext = { path: pathname, params, query };
      if (c.route.guard) {
        const verdict = c.route.guard(ctx);
        if (verdict === false) break; // → fallback
        if (typeof verdict === "string") {
          navigate(verdict, { replace: true });
          return;
        }
      }
      current.set({ route: c.route, ctx });
      return;
    }
    if (options.fallback && pathname !== options.fallback) {
      navigate(options.fallback, { replace: true });
    } else {
      current.set(null);
    }
  };

  function navigate(to: string, opts: { replace?: boolean } = {}): void {
    const hist = (globalThis as { history?: History }).history;
    if (hist) hist[opts.replace ? "replaceState" : "pushState"](null, "", to);
    resolve();
  }

  const onPop = (): void => resolve();
  const win = (globalThis as { addEventListener?: typeof addEventListener }).addEventListener
    ? (globalThis as unknown as Window)
    : undefined;
  if (win) win.addEventListener("popstate", onPop);
  resolve();

  function outlet(host: Element): () => void {
    return createRoot((dispose) => {
      let disposeCurrent: (() => void) | null = null;
      let gen = 0;
      const stop = effect(() => {
        const match = current();
        const token = ++gen;
        if (disposeCurrent) {
          disposeCurrent();
          disposeCurrent = null;
        }
        if (!match) return;
        const { route, ctx } = match;
        if (route.component) {
          disposeCurrent = mount(route.component, host, ctx);
        } else if (route.load) {
          route.load().then((mod) => {
            if (token !== gen) return; // navigated away before it loaded
            disposeCurrent = mount(mod.default, host, ctx);
          });
        }
      });
      onCleanup(() => {
        stop();
        if (disposeCurrent) disposeCurrent();
      });
      return dispose;
    });
  }

  return {
    current: () => current(),
    navigate,
    outlet,
    dispose() {
      if (win) win.removeEventListener("popstate", onPop);
    },
  };
}
