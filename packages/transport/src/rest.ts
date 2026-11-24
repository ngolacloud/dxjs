// @dxjs/transport/rest — a small typed REST client over fetch.
//
// Cancellation is first-class: pass a signal (resource() wires one to the
// component owner so a request is aborted on unmount, and stale responses can
// never overwrite newer state). Errors are typed and RFC-9457-aware.
//
// Resilience is opt-in via { timeout, retries, backoff } (see ./retry): a
// per-attempt timeout aborts a hung request, and transient failures (network
// errors, 5xx, 429, 408) are retried with exponential backoff. A 4xx (other
// than 429/408) is a client error and never retried.
//
// Retry is ALSO gated by idempotency. A failed attempt may have reached the
// server and taken effect before the response was lost, so replaying a
// non-idempotent method (POST, PATCH) risks a double write. Only idempotent
// methods (GET, HEAD, PUT, DELETE, OPTIONS) retry by default; a POST/PATCH
// retries only on explicit opt-in — `{ idempotent: true }` or an
// `Idempotency-Key` header that lets the server dedupe the replay.

import { type ResilienceOptions, attemptSignal, backoffDelay } from "./retry.ts";

export interface HttpError extends Error {
  status: number;
  body: unknown;
}

export interface ClientOptions extends ResilienceOptions {
  baseUrl?: string;
  /** Bearer token provider; sent only in the Authorization header. */
  auth?: () => string | null | undefined;
  /** Extra headers computed per request. */
  headers?: () => Record<string, string>;
  /** Injectable for tests / non-global environments. */
  fetch?: typeof fetch;
}

export interface RequestOptions extends ResilienceOptions {
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
  /** Force whether this request may be retried, overriding the method default.
   *  Set `true` to let a POST/PATCH retry (it is safe to replay — e.g. it carries
   *  an Idempotency-Key); set `false` to forbid retrying an otherwise-idempotent
   *  method. Unset → decided by the HTTP method. */
  idempotent?: boolean;
}

export interface Client {
  request<T>(method: string, path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  get<T>(path: string, opts?: RequestOptions): Promise<T>;
  post<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  put<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  patch<T>(path: string, body?: unknown, opts?: RequestOptions): Promise<T>;
  delete<T>(path: string, opts?: RequestOptions): Promise<T>;
}

function httpError(status: number, body: unknown): HttpError {
  const title =
    body && typeof body === "object" && "title" in body
      ? String((body as { title: unknown }).title)
      : `HTTP ${status}`;
  const err = new Error(title) as HttpError;
  err.name = "HttpError";
  err.status = status;
  err.body = body;
  return err;
}

function buildUrl(base: string, path: string, query?: RequestOptions["query"]): string {
  let url = path.startsWith("http://") || path.startsWith("https://") ? path : base + path;
  if (query) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined) qs.set(k, String(v));
    const s = qs.toString();
    if (s) url += (url.includes("?") ? "&" : "?") + s;
  }
  return url;
}

/** A transient HTTP status worth retrying: server errors, rate-limit, timeout. */
function retriableStatus(status: number): boolean {
  return status >= 500 || status === 429 || status === 408;
}

/** HTTP methods safe to replay: a repeat has the same effect as one call. */
function idempotentMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "GET" || m === "HEAD" || m === "PUT" || m === "DELETE" || m === "OPTIONS";
}

/** Case-insensitive presence check over an already-merged header map. */
function hasHeader(headers: Record<string, string>, name: string): boolean {
  const lower = name.toLowerCase();
  for (const k in headers) if (k.toLowerCase() === lower) return true;
  return false;
}

function isHttpError(e: unknown): e is HttpError {
  return e instanceof Error && e.name === "HttpError";
}

/** Create a REST client. */
export function createClient(options: ClientOptions = {}): Client {
  const base = options.baseUrl ?? "";

  async function request<T>(method: string, path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    const f = opts.fetch ?? options.fetch ?? fetch;
    const timeout = opts.timeout ?? options.timeout ?? 0;
    const retries = opts.retries ?? options.retries ?? 0;
    const backoff = opts.backoff ?? options.backoff ?? 0;

    const headers: Record<string, string> = { "content-type": "application/json" };
    const token = options.auth?.();
    if (token) headers["authorization"] = "Bearer " + token;
    if (options.headers) Object.assign(headers, options.headers());
    if (opts.headers) Object.assign(headers, opts.headers);

    const baseInit: RequestInit = { method, headers };
    if (body !== undefined) baseInit.body = JSON.stringify(body);
    const url = buildUrl(base, path, opts.query);

    // Replaying a lost non-idempotent write risks a double effect: cap its retry
    // budget at zero unless the caller opts in (explicit flag or Idempotency-Key).
    const canRetry = opts.idempotent ?? (idempotentMethod(method) || hasHeader(headers, "idempotency-key"));
    const maxRetries = canRetry ? retries : 0;

    for (let attempt = 0; ; attempt++) {
      // The caller's abort is final; a per-attempt timeout is retriable.
      const sig = attemptSignal(opts.signal, timeout);
      const init = sig ? { ...baseInit, signal: sig } : baseInit;
      try {
        const res = await f(url, init);
        const text = await res.text();
        let data: unknown = null;
        if (text) {
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }
        }
        if (res.ok) return data as T;
        if (attempt < maxRetries && retriableStatus(res.status)) {
          await backoffDelay(backoff, attempt + 1, opts.signal);
          continue;
        }
        throw httpError(res.status, data);
      } catch (e) {
        // A non-retriable HTTP status was thrown above — surface it as-is.
        if (isHttpError(e)) throw e;
        // The caller cancelled: never retry, never swallow.
        if (opts.signal?.aborted) throw e;
        // Network error or per-attempt timeout: retry while budget remains
        // (zero for a non-idempotent method without opt-in — see maxRetries).
        if (attempt < maxRetries) {
          await backoffDelay(backoff, attempt + 1, opts.signal);
          continue;
        }
        throw e;
      }
    }
  }

  return {
    request,
    get: (p, o) => request("GET", p, undefined, o),
    post: (p, b, o) => request("POST", p, b, o),
    put: (p, b, o) => request("PUT", p, b, o),
    patch: (p, b, o) => request("PATCH", p, b, o),
    delete: (p, o) => request("DELETE", p, undefined, o),
  };
}
