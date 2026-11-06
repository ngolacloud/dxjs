// @dxjs/transport/rest — a small typed REST client over fetch.
//
// Cancellation is first-class: pass a signal (resource() wires one to the
// component owner so a request is aborted on unmount, and stale responses can
// never overwrite newer state). Errors are typed and RFC-9457-aware.

export interface HttpError extends Error {
  status: number;
  body: unknown;
}

export interface ClientOptions {
  baseUrl?: string;
  /** Bearer token provider; sent only in the Authorization header. */
  auth?: () => string | null | undefined;
  /** Extra headers computed per request. */
  headers?: () => Record<string, string>;
  /** Injectable for tests / non-global environments. */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  signal?: AbortSignal;
  query?: Record<string, string | number | boolean | undefined>;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
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

/** Create a REST client. */
export function createClient(options: ClientOptions = {}): Client {
  const base = options.baseUrl ?? "";

  async function request<T>(method: string, path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    const f = opts.fetch ?? options.fetch ?? fetch;
    const headers: Record<string, string> = { "content-type": "application/json" };
    const token = options.auth?.();
    if (token) headers["authorization"] = "Bearer " + token;
    if (options.headers) Object.assign(headers, options.headers());
    if (opts.headers) Object.assign(headers, opts.headers);

    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    if (opts.signal) init.signal = opts.signal;

    const res = await f(buildUrl(base, path, opts.query), init);
    const text = await res.text();
    let data: unknown = null;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    }
    if (!res.ok) throw httpError(res.status, data);
    return data as T;
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
