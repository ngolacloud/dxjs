// @dxjs/dev client — the browser-side HMR runtime. Served verbatim (transpiled)
// at /@dx/client.js and pulled in by every dev module via an injected
// `import.meta.hot = createHotContext(id)` banner.
//
// CSP-safe by construction: the ONLY ways it reacts to an edit are a dynamic
// `import()` of a same-origin module URL (allowed by `script-src 'self'`, no
// `unsafe-eval`) and a long-poll `fetch` (allowed by `connect-src 'self'`). No
// eval, no `new Function`, no inline handler, no innerHTML.

/** A module's hot context. `data` persists across re-imports of the same id, so
 *  a component can stash its signals there and keep them alive through an edit. */
export interface DxHot {
  /** A per-module bag that SURVIVES hot re-imports (keyed by module id). */
  readonly data: Record<string, unknown>;
  /** Mark this module a hot boundary. With no callback it is self-accepting:
   *  on update the runtime re-imports it (its top-level re-runs). With a
   *  callback, the callback receives the fresh module namespace. */
  accept(cb?: (mod: unknown) => void): void;
  /** Run `cb(data)` right before this module is replaced (optional teardown). */
  dispose(cb: (data: Record<string, unknown>) => void): void;
  /** Force a full page reload. */
  invalidate(): void;
}

interface Registration {
  data: Record<string, unknown>;
  accepted: boolean;
  cb: ((mod: unknown) => void) | null;
  disposeCb: ((data: Record<string, unknown>) => void) | null;
}

interface Update {
  path: string;
  version: number;
}

const registry = new Map<string, Registration>();

/** Create (or re-attach to) the hot context for `id`. Re-running a module hits
 *  the SAME registration, so `data` — and anything a module stored there, like a
 *  signal — is preserved across the swap. */
export function createHotContext(id: string): DxHot {
  let reg = registry.get(id);
  if (!reg) {
    reg = { data: {}, accepted: false, cb: null, disposeCb: null };
    registry.set(id, reg);
  }
  const r = reg;
  r.disposeCb = null; // a re-run re-registers its own teardown
  return {
    get data(): Record<string, unknown> {
      return r.data;
    },
    accept(cb?: (mod: unknown) => void): void {
      r.accepted = true;
      r.cb = cb ?? null;
    },
    dispose(cb: (data: Record<string, unknown>) => void): void {
      r.disposeCb = cb;
    },
    invalidate(): void {
      fullReload();
    },
  };
}

function fullReload(): void {
  location.reload();
}

async function applyUpdate(u: Update): Promise<void> {
  const reg = registry.get(u.path);
  // A changed module with no hot boundary can't swap safely → full reload.
  if (!reg || !reg.accepted) {
    fullReload();
    return;
  }
  if (reg.disposeCb) {
    try {
      reg.disposeCb(reg.data);
    } catch (err) {
      console.error("[dxjs] dispose handler threw", err);
    }
  }
  // Re-import with a fresh query so the browser fetches the new source. Only
  // THIS module's version changed; its (unchanged) dependency URLs keep their
  // version, so the browser reuses the cached @dxjs/core etc. — the signal graph
  // stays intact and the stored signal keeps reacting.
  const mod = await import(u.path + "?v=" + u.version);
  if (reg.cb) reg.cb(mod);
  console.log("[dxjs] hot update → " + u.path);
}

interface PollMessage {
  epoch: number;
  updates: Update[];
}

async function poll(since: number): Promise<void> {
  let next = since;
  try {
    const res = await fetch("/@dx/hmr?since=" + since, { cache: "no-store" });
    if (res.status === 200) {
      const msg = (await res.json()) as PollMessage;
      next = msg.epoch;
      for (const u of msg.updates) await applyUpdate(u);
    }
    // 204 → nothing changed within the window; just poll again.
  } catch {
    // The dev server is restarting or the network blipped. Pause briefly so we
    // don't spin, then retry (the next fetch will reconnect).
    await sleep(1000);
  }
  poll(next);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

poll(0);
console.log("[dxjs] dev client connected — HMR via long-poll under strict CSP");
