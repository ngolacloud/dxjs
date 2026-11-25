// @dxjs/component/router — a small History-API router with NESTED routes,
// shared LAYOUTS and per-route LOADERS.
//
// Routes form a tree; a URL matches a CHAIN of routes (root layout → … → leaf).
// A layout renders `Outlet()` where its active child mounts. Navigating between
// sibling children re-mounts only the child — the shared layout (and its signals)
// is preserved, because each depth has its own reactive slot keyed by that
// level's own path/params. A `loader(ctx)` runs on activation and exposes its
// result reactively as `ctx.data()` (undefined until it resolves).
//
// Matching `/users/:id` style patterns; the current match is a signal; the
// outlet swaps the mounted component on navigation (disposing the previous one —
// no leaked effects/listeners). Routes may be lazy (`load: () => import(...)`).
//
// Guards are UX-only: they decide what to SHOW. Authorization is always enforced
// by the backend (the StillJS audit's SEC-007 lesson) — never trust a guard.

import {
  signal,
  effect,
  createRoot,
  onCleanup,
  createContext,
  provide,
  inject,
  type Accessor,
} from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { mount, type Component } from "./index.ts";

/** Decode a path segment, falling back to the raw value on a malformed escape.
 *  `decodeURIComponent("%E0%A4")` throws `URIError`; an attacker-shaped URL must
 *  not crash the router, so a bad escape yields the undecoded segment. (Audit L3) */
function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/** Per-level context passed to a route's component. `data()` is this level's
 *  loader result (undefined until it resolves, or when there is no loader). */
export interface RouteContext {
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  data: Accessor<unknown>;
}

/** A guard returns true (allow), false (block), or a path string (redirect). */
export type Guard = (ctx: RouteContext) => boolean | string;

export interface Route {
  path: string;
  /** A synchronous component… */
  component?: Component<RouteContext>;
  /** …or a lazy one for code-splitting. */
  load?: () => Promise<{ default: Component<RouteContext> }>;
  /** Run on activation; its result is exposed as `ctx.data()` (reactive). */
  loader?: (ctx: RouteContext) => unknown | Promise<unknown>;
  guard?: Guard;
  /** Child routes, mounted into this route's `Outlet()` (makes it a layout). */
  children?: Route[];
}

export interface RouterOptions {
  /** Path to redirect to when nothing matches or a guard blocks. */
  fallback?: string;
}

/** One level of the matched chain (root layout first, leaf last). */
export interface MatchLevel {
  route: Route;
  ctx: RouteContext;
  /** Remount identity for this level: its own path + its own param values. Two
   *  navigations with the same key at a level keep that level mounted. */
  key: string;
}

export interface Match {
  route: Route;
  ctx: RouteContext;
}

export interface Router {
  /** Reactive current LEAF match (null before the first resolve or when blocked). */
  current: Accessor<Match | null>;
  /** Reactive full matched chain (root → leaf). */
  matches: Accessor<MatchLevel[]>;
  navigate(to: string, opts?: { replace?: boolean }): void;
  /** Mount the matched chain into `host`; returns a disposer. */
  outlet(host: Element): () => void;
  dispose(): void;
}

// --- context (so a layout's Outlet knows which depth to render) ------------
interface RouterCtxValue {
  matches: Accessor<MatchLevel[]>;
  depth: number;
}
const RouterContext = createContext<RouterCtxValue | null>(null);

// --- pattern compilation + tree flattening --------------------------------
interface Flat {
  chain: Route[];
  pattern: string;
  /** Param names introduced at each chain level (parallel to `chain`). */
  levelNames: string[][];
}

function ownNames(path: string): string[] {
  const names: string[] = [];
  for (const seg of path.split("/")) {
    if (seg.startsWith(":")) names.push(seg.slice(1));
    else if (seg === "*") names.push("rest");
  }
  return names;
}

function joinPath(prefix: string, path: string): string {
  const a = prefix.replace(/\/+$/, "");
  const b = path.replace(/^\/+/, "");
  if (!b) return a === "" ? "/" : a;
  return (a === "" ? "" : a) + "/" + b;
}

/** Depth-first flatten the route tree into one entry per LEAF (a route with no
 *  children), carrying its full pattern and ancestor chain. */
function flatten(routes: Route[], prefix: string, chain: Route[]): Flat[] {
  const out: Flat[] = [];
  for (const r of routes) {
    const full = joinPath(prefix, r.path);
    const nextChain = [...chain, r];
    if (r.children && r.children.length) {
      out.push(...flatten(r.children, full, nextChain));
    } else {
      out.push({ chain: nextChain, pattern: full, levelNames: nextChain.map((c) => ownNames(c.path)) });
    }
  }
  return out;
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

interface Compiled extends Flat {
  re: RegExp;
  names: string[];
}

function getLocation(): { pathname: string; search: string } {
  const loc = (globalThis as { location?: { pathname: string; search: string } }).location;
  return { pathname: loc?.pathname ?? "/", search: loc?.search ?? "" };
}

/** Create a router over the given (possibly nested) routes. Resolves eagerly. */
export function createRouter(routes: Route[], options: RouterOptions = {}): Router {
  const compiled: Compiled[] = flatten(routes, "", []).map((f) => {
    const { re, names } = compile(f.pattern);
    return { ...f, re, names };
  });
  const matchesSig = signal<MatchLevel[]>([]);

  function buildLevels(c: Compiled, m: RegExpExecArray, pathname: string, query: URLSearchParams): MatchLevel[] {
    const params: Record<string, string> = {};
    c.names.forEach((n, i) => {
      params[n] = safeDecode(m[i + 1] ?? "");
    });
    return c.chain.map((route, i) => {
      const data = signal<unknown>(undefined);
      const ctx: RouteContext = { path: pathname, params, query, data: () => data() };
      // Loader runs on activation; its result flows into ctx.data() reactively.
      if (route.loader) {
        const out = route.loader(ctx);
        if (out && typeof (out as Promise<unknown>).then === "function") {
          (out as Promise<unknown>).then((v) => data.set(v)).catch(() => data.set(undefined));
        } else {
          data.set(out);
        }
      }
      const own = c.levelNames[i] ?? [];
      const key = route.path + "|" + own.map((n) => params[n]).join(",");
      return { route, ctx, key };
    });
  }

  const resolve = (): void => {
    const { pathname, search } = getLocation();
    const query = new URLSearchParams(search);
    for (const c of compiled) {
      const m = c.re.exec(pathname);
      if (!m) continue;
      const levels = buildLevels(c, m, pathname, query);
      // Guards run root → leaf; the first to block/redirect wins.
      let blocked = false;
      for (const lvl of levels) {
        const g = lvl.route.guard;
        if (!g) continue;
        const verdict = g(lvl.ctx);
        if (verdict === false) {
          blocked = true;
          break;
        }
        if (typeof verdict === "string") {
          navigate(verdict, { replace: true });
          return;
        }
      }
      if (blocked) break; // → fallback
      matchesSig.set(levels);
      return;
    }
    if (options.fallback && pathname !== options.fallback) {
      navigate(options.fallback, { replace: true });
    } else {
      matchesSig.set([]);
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

  // Reactively mount the chain level `level` into `host`, keyed so an unchanged
  // level is NOT remounted (shared-layout preservation). Must run inside an owner.
  function mountLevel(host: Element, level: number): void {
    let disposeCur: (() => void) | null = null;
    let curKey: string | null | undefined = undefined;
    let gen = 0;
    const stop = effect(() => {
      const lvl = matchesSig()[level];
      const key = lvl ? lvl.key : null;
      if (key === curKey) return; // same identity → keep this level mounted
      curKey = key;
      const token = ++gen;
      if (disposeCur) {
        disposeCur();
        disposeCur = null;
      }
      if (!lvl) return;
      const childCtx: RouterCtxValue = { matches: () => matchesSig(), depth: level + 1 };
      const place = (comp: Component<RouteContext>): void => {
        if (token !== gen) return;
        disposeCur = provide(RouterContext, childCtx, () => mount(comp, host, lvl.ctx));
      };
      if (lvl.route.component) place(lvl.route.component);
      else if (lvl.route.load) lvl.route.load().then((mod) => place(mod.default));
    });
    onCleanup(() => {
      stop();
      if (disposeCur) disposeCur();
    });
  }

  function outlet(host: Element): () => void {
    return createRoot((dispose) => {
      mountLevel(host, 0);
      return dispose;
    });
  }

  const current = (): Match | null => {
    const ms = matchesSig();
    const leaf = ms[ms.length - 1];
    return leaf ? { route: leaf.route, ctx: leaf.ctx } : null;
  };

  return {
    current,
    matches: () => matchesSig(),
    navigate,
    outlet,
    dispose() {
      if (win) win.removeEventListener("popstate", onPop);
    },
  };
}

/** A layout's child slot. Place it in a layout's view (`html`…${Outlet()}…``)
 *  and the router mounts the active child route here, preserving THIS layout
 *  across sibling-child navigations. Resolves its depth from the router context,
 *  so it only works inside a routed component. */
export function Outlet(): TemplateResult {
  const rc = inject(RouterContext);
  return html`<dx-outlet
    ref=${(host: Element): void => {
      if (!rc) return;
      // Owned by the enclosing layout's root (we are inside its mount), so this
      // slot is torn down with the layout. Mirrors mountLevel but reads the
      // depth from context.
      let disposeCur: (() => void) | null = null;
      let curKey: string | null | undefined = undefined;
      let gen = 0;
      const stop = effect(() => {
        const lvl = rc.matches()[rc.depth];
        const key = lvl ? lvl.key : null;
        if (key === curKey) return;
        curKey = key;
        const token = ++gen;
        if (disposeCur) {
          disposeCur();
          disposeCur = null;
        }
        if (!lvl) return;
        const childCtx: RouterCtxValue = { matches: rc.matches, depth: rc.depth + 1 };
        const place = (comp: Component<RouteContext>): void => {
          if (token !== gen) return;
          disposeCur = provide(RouterContext, childCtx, () => mount(comp, host, lvl.ctx));
        };
        if (lvl.route.component) place(lvl.route.component);
        else if (lvl.route.load) lvl.route.load().then((mod) => place(mod.default));
      });
      onCleanup(() => {
        stop();
        if (disposeCur) disposeCur();
      });
    }}
  ></dx-outlet>`;
}
