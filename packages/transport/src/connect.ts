// @dxjs/transport/connect — a minimal Connect (connectrpc) unary client (JSON).
//
// Native gRPC is not reachable from a browser (no HTTP/2 trailer access), so in
// the browser dxjs speaks Connect: a plain POST to /{service}/{method} with a
// JSON body, understood by a Connect-enabled backend (e.g. Rust/tonic+Connect)
// with NO proxy. When dxjs runs on a server/edge co-located with the backend,
// use native gRPC there instead. Binary (protobuf) codec and streaming are later
// increments; this is unary JSON.

export interface ConnectOptions {
  baseUrl?: string;
  auth?: () => string | null | undefined;
  fetch?: typeof fetch;
}

export interface ConnectCallOptions {
  signal?: AbortSignal;
  fetch?: typeof fetch;
}

export interface ConnectError extends Error {
  code: string;
}

export interface ConnectClient {
  unary<Req, Res>(service: string, method: string, message: Req, opts?: ConnectCallOptions): Promise<Res>;
}

function connectError(code: string, message: string): ConnectError {
  const err = new Error(message) as ConnectError;
  err.name = "ConnectError";
  err.code = code;
  return err;
}

/** Create a Connect unary (JSON) client. */
export function createConnectClient(options: ConnectOptions = {}): ConnectClient {
  const base = options.baseUrl ?? "";
  return {
    async unary<Req, Res>(service, method, message, opts: ConnectCallOptions = {}): Promise<Res> {
      const f = opts.fetch ?? options.fetch ?? fetch;
      const headers: Record<string, string> = {
        "content-type": "application/json",
        "connect-protocol-version": "1",
      };
      const token = options.auth?.();
      if (token) headers["authorization"] = "Bearer " + token;

      const init: RequestInit = { method: "POST", headers, body: JSON.stringify(message) };
      if (opts.signal) init.signal = opts.signal;

      const res = await f(`${base}/${service}/${method}`, init);
      const text = await res.text();
      let data: unknown = {};
      if (text) {
        try {
          data = JSON.parse(text);
        } catch {
          data = {};
        }
      }
      if (!res.ok) {
        const e = data as { code?: string; message?: string };
        throw connectError(e.code ?? "unknown", e.message ?? `connect ${res.status}`);
      }
      return data as Res;
    },
  };
}
