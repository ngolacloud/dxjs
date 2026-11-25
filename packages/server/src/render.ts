// @dxjs/server — SSR string renderer (DOM-free, edge-ready).
//
// Renders a `html``` view to an HTML string using the SAME escaping discipline
// as the live renderer: text and attribute values are escaped, @event handlers
// are dropped (no server-side listeners), .prop becomes its attribute, ?attr is
// a boolean. Only Web-standard APIs → runs on Node and every edge runtime.
//
// Constraint (same as the client): an interpolation must be the ENTIRE attribute
// value, and @/?/. attributes are written unquoted (`@click=${fn}`).

import { untrack } from "@dxjs/core";
import { escape, isUrlAttr, sanitizeUrl, isUnsafeProp, type TemplateResult } from "@dxjs/dom";

function isTemplate(v: unknown): v is TemplateResult {
  return !!v && typeof v === "object" && (v as { _dx?: unknown })._dx === true;
}
function unwrap(v: unknown): unknown {
  return typeof v === "function" ? untrack(() => (v as () => unknown)()) : v;
}

// A `child` interpolation lands in text; an `attr` one inside a start tag. A
// `rawtext` one lands inside a RAW-TEXT element (`<script>`/`<style>`), where HTML
// entities are NOT decoded — so `escape()` neither prevents a `</script>`/`</style>`
// breakout usefully nor stops CSS/JS injection. There is no safe generic escaping of
// untrusted data into CSS/JS, so a rawtext interpolation is REFUSED (dropped), the
// same posture as inline `on*` (M1) and raw-HTML `.prop` (M2). (Audit L1)
function scanContexts(strings: ReadonlyArray<string>): Array<"attr" | "child" | "rawtext"> {
  const ctx: Array<"attr" | "child" | "rawtext"> = [];
  let inTag = false;
  let quote = "";
  let name = ""; // tag name being read right after `<`
  let reading = false; // reading the tag name
  let rawTag = ""; // non-empty while inside a <script>/<style> raw-text element
  for (let i = 0; i < strings.length; i++) {
    const s = strings[i] as string;
    for (let j = 0; j < s.length; j++) {
      const c = s[j] as string;
      if (rawTag) {
        // Only the matching end tag (`</script`/`</style`, case-insensitive) closes it.
        if (c === "<" && s.slice(j, j + rawTag.length + 2).toLowerCase() === `</${rawTag}`) {
          rawTag = "";
          inTag = true;
        }
        continue;
      }
      if (quote) {
        if (c === quote) quote = "";
      } else if (inTag) {
        if (c === '"' || c === "'") quote = c;
        else if (reading && /[a-z]/i.test(c)) name += c.toLowerCase();
        else if (c === ">") {
          inTag = false;
          reading = false;
          if (name === "script" || name === "style") rawTag = name;
          name = "";
        } else reading = false;
      } else if (c === "<") {
        inTag = true;
        reading = true;
        name = "";
      }
    }
    if (i < strings.length - 1) ctx.push(rawTag ? "rawtext" : inTag ? "attr" : "child");
  }
  return ctx;
}

function isList(v: unknown): v is {
  items: (() => unknown[]) | unknown[];
  render: (item: unknown, i: number) => TemplateResult;
} {
  return !!v && typeof v === "object" && (v as { _dxlist?: unknown })._dxlist === true;
}

// --- async boundaries: Suspense + Error boundary --------------------------
// Light marker objects (like list/template) the renderer recognises. They let a
// view declare async content and error isolation without any DOM or framework
// coupling — the SAME markers work in the sync string path and the stream.

/** An async content boundary: `fallback` shows synchronously (or in the sync
 *  render); `load()` resolves the real content during streaming. */
export interface SuspenseResult {
  readonly _dxsuspense: true;
  fallback: unknown;
  load: () => unknown | Promise<unknown>;
}
export function suspense(fallback: unknown, load: () => unknown | Promise<unknown>): SuspenseResult {
  return { _dxsuspense: true, fallback, load };
}
function isSuspense(v: unknown): v is SuspenseResult {
  return !!v && typeof v === "object" && (v as { _dxsuspense?: unknown })._dxsuspense === true;
}

/** An error boundary: if rendering `children` throws (sync) or rejects (stream),
 *  `fallback(err)` is rendered instead — atomically, never a half-written child. */
export interface ErrorBoundaryResult {
  readonly _dxerror: true;
  children: unknown;
  fallback: (err: unknown) => unknown;
}
export function errorBoundary(children: unknown, fallback: (err: unknown) => unknown): ErrorBoundaryResult {
  return { _dxerror: true, children, fallback };
}
function isErrorBoundary(v: unknown): v is ErrorBoundaryResult {
  return !!v && typeof v === "object" && (v as { _dxerror?: unknown })._dxerror === true;
}

function childToString(value: unknown): string {
  if (isList(value)) {
    const arr = typeof value.items === "function" ? untrack(() => (value.items as () => unknown[])()) : value.items;
    return arr.map((item, i) => renderToString(value.render(item, i))).join("");
  }
  // Sync render can't await: a Suspense shows its fallback.
  if (isSuspense(value)) return childToString(value.fallback);
  // Error boundary: render children; on throw, render the fallback (atomic).
  if (isErrorBoundary(value)) {
    try {
      return childToString(value.children);
    } catch (err) {
      return childToString(value.fallback(err));
    }
  }
  const v = unwrap(value);
  if (v == null || v === false || v === true || v === "") return "";
  if (isTemplate(v)) return renderToString(v);
  if (Array.isArray(v)) return v.map(childToString).join("");
  return escape(String(v));
}

const ATTR_TAIL = /([.@?]?[A-Za-z_][\w:-]*)=("?)$/;

function appendAttr(out: string, value: unknown): string {
  const m = ATTR_TAIL.exec(out);
  if (!m) return out; // not an attribute binding we recognise; leave as-is
  const name = m[1] as string;
  const quoted = m[2] === '"';
  const prefix = name[0];
  const head = out.slice(0, m.index); // `out` with the `name=` tail stripped

  // Events and refs are client-only. Drop them BEFORE unwrapping: their value is a
  // function that is not a reactive thunk, and calling it would run the handler (or
  // the ref callback) on the server. (main: never call @event handlers/refs)
  if (prefix === "@" || name === "ref") return head; // drop event / ref
  const v = unwrap(value);
  if (prefix === "?") return v ? `${head}${name.slice(1)}` : head;
  if (prefix === ".") {
    const real = name.slice(1);
    // Drop raw-HTML properties entirely (don't even emit an inert attribute): the
    // live renderer and hydration refuse them, so emitting one would re-introduce
    // the SSR↔hydration mismatch. (M2)
    if (isUnsafeProp(real)) return head;
    const body = `${head}${real}="${escape(v)}`;
    return quoted ? body : `${body}"`;
  }
  // An on* name without `@` must not be written as an inline handler — drop it. (M1)
  if (/^on/i.test(name)) return head;
  // normal attribute
  if (v == null || v === false) return head; // omit
  if (v === true) return `${head}${name}`;
  // URL-bearing attributes get scheme-sanitised before escaping (H1).
  const safe = isUrlAttr(name) ? sanitizeUrl(String(v)) : v;
  return quoted ? `${out}${escape(safe)}` : `${head}${name}="${escape(safe)}"`;
}

export interface RenderOptions {
  /**
   * Emit hydration markers so `hydrate` can attach reactive bindings to this
   * exact output: `<!--dx:i-->…<!--/dx:i-->` around dynamic children and
   * `data-dxh-i` on elements with a bound attribute/event. Default false.
   */
  hydratable?: boolean;
}

/** Render a view to an HTML string (escaped, CSP-safe markup). */
export function renderToString(view: TemplateResult, options: RenderOptions = {}): string {
  const { strings, values } = view;
  const ctx = scanContexts(strings);
  let out = "";
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) {
      if (ctx[i] === "rawtext") {
        // Refuse dynamic content inside <script>/<style>: drop it, no marker. (L1)
      } else if (ctx[i] === "child") {
        const content = childToString(values[i]); // nested templates render markerless
        out += options.hydratable ? `<!--dx:${i}-->${content}<!--/dx:${i}-->` : content;
      } else {
        out = appendAttr(out, values[i]);
        if (options.hydratable) out += ` data-dxh-${i}=""`;
      }
    }
  }
  return out;
}

// --- streaming SSR --------------------------------------------------------
// `renderToStream` renders to a Web `ReadableStream` (edge-ready), flushing the
// shell up to the first pending Suspense immediately and streaming each boundary
// IN DOCUMENT ORDER as its `load()` resolves. In-order streaming needs no inline
// swap script, so it stays strict-CSP safe (unlike out-of-order techniques). An
// attribute binding never crosses a chunk boundary — the buffer is flushed only
// at CHILD positions, which are always safe split points.

// --- streaming resilience (M11) -------------------------------------------
// Every streaming entry point bounds each Suspense `load()` by a timeout (and an
// optional abort signal) and, in the out-of-order path, by a concurrency limit. A
// boundary that times out, rejects or is aborted degrades to its own fallback —
// it NEVER hangs the response nor truncates the document already emitted.

/** Resilience knobs for the streaming SSR entry points. */
export interface StreamOptions {
  /** Max ms to await each Suspense `load()` before showing its fallback.
   *  Default 30000. `0` or `Infinity` disables the per-boundary timeout. */
  timeout?: number;
  /** Max Suspense boundaries loaded concurrently (out-of-order path). Default 8. */
  concurrency?: number;
  /** When aborted, pending boundaries stop (each shows its fallback) and the
   *  stream ends. */
  signal?: AbortSignal;
}

interface Opts {
  timeout: number;
  concurrency: number;
  signal?: AbortSignal;
}

function resolveOpts(o: StreamOptions = {}): Opts {
  return {
    timeout: o.timeout ?? 30000,
    concurrency: o.concurrency && o.concurrency > 0 ? o.concurrency : 8,
    signal: o.signal,
  };
}

/** Await a boundary's `load()` under its timeout + abort signal. Rejects on
 *  timeout or abort (the caller then renders the fallback) and ALWAYS clears its
 *  timer on settle, so a never-resolving `load()` leaves nothing alive in the
 *  event loop once the timeout fires. */
function loadBounded(load: () => unknown | Promise<unknown>, o: Opts): Promise<unknown> {
  if ((!o.timeout || o.timeout === Infinity) && !o.signal) return Promise.resolve().then(load);
  return new Promise<unknown>((resolve, reject) => {
    // Already aborted: reject WITHOUT invoking load() — otherwise a rejecting load()
    // would be a promise with no attached handler → unhandledRejection. (verify fix)
    if (o.signal?.aborted) {
      reject(o.signal.reason ?? new Error("aborted"));
      return;
    }
    const p = Promise.resolve().then(load);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const settle =
      (fn: (v: unknown) => void) =>
      (v: unknown): void => {
        if (timer) clearTimeout(timer);
        o.signal?.removeEventListener("abort", onAbort);
        fn(v);
      };
    const onAbort = (): void => settle(reject)(o.signal?.reason ?? new Error("aborted"));
    if (o.timeout && o.timeout !== Infinity) {
      timer = setTimeout(() => settle(reject)(new Error("Suspense boundary timed out")), o.timeout);
    }
    if (o.signal) o.signal.addEventListener("abort", onAbort);
    p.then(settle(resolve), settle(reject));
  });
}

// `guarded` is true when an errorBoundary is active above this node: a failing
// Suspense then RE-THROWS so the nearest boundary (which buffers its subtree)
// renders its fallback atomically — preserving the existing boundary semantics.
// With no boundary above, a failing Suspense degrades to its OWN fallback in place:
// that is the only way the in-order stream can emit the trailing shell instead of
// truncating the document at the point of failure. (M11)
async function* streamChild(value: unknown, o: Opts, guarded = false): AsyncGenerator<string> {
  if (isSuspense(value)) {
    let loaded: unknown;
    try {
      loaded = await loadBounded(value.load, o);
    } catch (err) {
      if (guarded) throw err; // let an enclosing errorBoundary handle it
      // Timeout / rejection / abort, unguarded → show the fallback; never truncate.
      yield* streamChild(value.fallback, o, guarded);
      return;
    }
    yield* streamChild(loaded, o, guarded);
    return;
  }
  if (isErrorBoundary(value)) {
    // Buffer the subtree so a mid-stream throw/reject yields ONLY the fallback.
    try {
      const parts: string[] = [];
      for await (const c of streamChild(value.children, o, true)) parts.push(c);
      for (const c of parts) yield c;
    } catch (err) {
      yield* streamChild(value.fallback(err), o, guarded);
    }
    return;
  }
  if (isList(value)) {
    const arr =
      typeof value.items === "function" ? untrack(() => (value.items as () => unknown[])()) : value.items;
    for (let i = 0; i < arr.length; i++) yield* streamView(value.render(arr[i], i), o, guarded);
    return;
  }
  const v = unwrap(value);
  if (v == null || v === false || v === true || v === "") return;
  if (isTemplate(v)) {
    yield* streamView(v, o, guarded);
    return;
  }
  if (Array.isArray(v)) {
    for (const x of v) yield* streamChild(x, o, guarded);
    return;
  }
  yield escape(String(v));
}

async function* streamView(view: TemplateResult, o: Opts, guarded = false): AsyncGenerator<string> {
  const { strings, values } = view;
  const ctx = scanContexts(strings);
  let out = "";
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) {
      if (ctx[i] === "rawtext") {
        // Refuse dynamic content inside <script>/<style>: drop it. (L1)
      } else if (ctx[i] === "child") {
        if (out) {
          yield out; // flush the shell before awaiting any async child
          out = "";
        }
        yield* streamChild(values[i], o, guarded);
      } else {
        out = appendAttr(out, values[i]); // attribute: edits the un-yielded buffer
      }
    }
  }
  if (out) yield out;
}

/** Render a view to an async string generator, awaiting Suspense boundaries. */
export function renderToChunks(view: TemplateResult, options?: StreamOptions): AsyncGenerator<string> {
  return streamView(view, resolveOpts(options));
}

/** Render a view to a complete HTML string, awaiting every Suspense boundary. */
export async function renderToStringAsync(view: TemplateResult, options?: StreamOptions): Promise<string> {
  let html = "";
  for await (const chunk of streamView(view, resolveOpts(options))) html += chunk;
  return html;
}

/** Render a view to a Web `ReadableStream<Uint8Array>` (edge-ready), streaming
 *  the shell first and each Suspense boundary in document order as it resolves. */
export function renderToStream(view: TemplateResult, options?: StreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const gen = streamView(view, resolveOpts(options));
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await gen.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value));
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      void gen.return(undefined);
    },
  });
}

// --- out-of-order streaming SSR -------------------------------------------
// Unlike `renderToStream` (which awaits each Suspense in document order), this
// flushes the whole shell FIRST with a `<dxs-slot data-dxs="N">fallback</dxs-slot>`
// placeholder per boundary, then streams each boundary's real content AS IT
// RESOLVES (any order) as `<template data-dxs-content="N">…</template>`. A tiny
// same-origin client (`installStreamClient`, bundled by the consumer → script-src
// 'self') swaps each template into its slot. No inline script, no eval → strict-CSP
// safe even though content arrives out of document order.

interface CollectState {
  nextId: number;
}
interface PendingBoundary {
  id: number;
  boundary: SuspenseResult;
}

/** Render a renderable to HTML, turning each Suspense into a numbered placeholder
 *  slot and pushing its boundary onto `queue` (to be resolved + streamed later). */
function renderCollecting(value: unknown, state: CollectState, queue: PendingBoundary[]): string {
  if (isList(value)) {
    const arr =
      typeof value.items === "function" ? untrack(() => (value.items as () => unknown[])()) : value.items;
    return arr.map((item, i) => renderCollecting(value.render(item, i), state, queue)).join("");
  }
  if (isSuspense(value)) {
    const id = ++state.nextId;
    queue.push({ id, boundary: value });
    return `<dxs-slot data-dxs="${id}">${renderCollecting(value.fallback, state, queue)}</dxs-slot>`;
  }
  if (isErrorBoundary(value)) {
    try {
      return renderCollecting(value.children, state, queue);
    } catch (err) {
      return renderCollecting(value.fallback(err), state, queue);
    }
  }
  const v = unwrap(value);
  if (v == null || v === false || v === true || v === "") return "";
  if (isTemplate(v)) return renderTemplateCollecting(v, state, queue);
  if (Array.isArray(v)) return v.map((x) => renderCollecting(x, state, queue)).join("");
  return escape(String(v));
}

function renderTemplateCollecting(view: TemplateResult, state: CollectState, queue: PendingBoundary[]): string {
  const { strings, values } = view;
  const ctx = scanContexts(strings);
  let out = "";
  for (let i = 0; i < strings.length; i++) {
    out += strings[i];
    if (i < values.length) {
      if (ctx[i] === "rawtext") {
        /* refuse dynamic <script>/<style> content (L1) */
      } else if (ctx[i] === "child") out += renderCollecting(values[i], state, queue);
      else out = appendAttr(out, values[i]);
    }
  }
  return out;
}

async function* oooChunks(view: TemplateResult, o: Opts): AsyncGenerator<string> {
  const state: CollectState = { nextId: 0 };
  const queue: PendingBoundary[] = [];
  // 1) the shell, with a placeholder slot per boundary — flushed immediately.
  yield renderTemplateCollecting(view, state, queue);

  // 2) resolve boundaries AS COMPLETED (not in document order), streaming each —
  //    at most `o.concurrency` in flight, each bounded by `o.timeout`/signal.
  type Settled = { id: number; result?: unknown; error?: unknown; ref: Promise<Settled> };
  const waiting: PendingBoundary[] = queue.splice(0);
  const pool = new Set<Promise<Settled>>();
  const start = (b: PendingBoundary): void => {
    // Assigned synchronously below, before the async body (which reads `ref`) runs;
    // the `!` tells TS what its definite-assignment analysis can't see here.
    let ref!: Promise<Settled>;
    ref = (async (): Promise<Settled> => {
      try {
        return { id: b.id, result: await loadBounded(b.boundary.load, o), ref };
      } catch (err) {
        return { id: b.id, error: err, ref };
      }
    })();
    pool.add(ref);
  };
  const fill = (): void => {
    while (pool.size < o.concurrency && waiting.length) start(waiting.shift() as PendingBoundary);
  };
  fill();

  while (pool.size) {
    const settled = await Promise.race(pool);
    pool.delete(settled.ref);
    if (!("error" in settled)) {
      // The resolved content may itself contain nested Suspense → more pending.
      const html = renderCollecting(settled.result, state, queue);
      for (const b of queue.splice(0)) waiting.push(b);
      yield `<template data-dxs-content="${settled.id}">${html}</template>`;
    }
    // A rejected/timed-out boundary keeps its fallback slot (already in the shell):
    // graceful degradation, never a truncated document.
    fill();
  }
}

/** Render a view to an async string generator, streaming Suspense boundaries
 *  out-of-order (shell first, then each boundary as it resolves). */
export function renderToChunksOOO(view: TemplateResult, options?: StreamOptions): AsyncGenerator<string> {
  return oooChunks(view, resolveOpts(options));
}

/** Out-of-order streaming SSR to a Web `ReadableStream<Uint8Array>`. Pair with
 *  `installStreamClient` on the browser (same-origin, script-src 'self'). */
export function renderToStreamOOO(view: TemplateResult, options?: StreamOptions): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const gen = oooChunks(view, resolveOpts(options));
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await gen.next();
        if (done) controller.close();
        else controller.enqueue(encoder.encode(value));
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      void gen.return(undefined);
    },
  });
}

/** The per-value binding plan of a template, derived from its static strings. */
export function planParts(
  strings: ReadonlyArray<string>,
): Array<{ kind: "child" } | { kind: "attr"; name: string }> {
  const ctx = scanContexts(strings);
  const parts: Array<{ kind: "child" } | { kind: "attr"; name: string }> = [];
  for (let i = 0; i < ctx.length; i++) {
    // A rawtext interpolation is refused by the SSR renderers (no marker emitted);
    // keep it a child slot so part/value indices stay aligned — hydration then finds
    // no marker for it and safely binds nothing. (L1)
    if (ctx[i] === "child" || ctx[i] === "rawtext") parts.push({ kind: "child" });
    else {
      const m = /([.@?]?[A-Za-z_][\w:-]*)=("?)$/.exec(strings[i] as string);
      parts.push({ kind: "attr", name: m ? (m[1] as string) : "" });
    }
  }
  return parts;
}
