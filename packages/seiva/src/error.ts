// @dxjs/seiva/error — map any transport failure into a structured SeivaError so the
// robustness of a mature Seiva backend reaches the user intact: precise, recoverable
// errors. Handles the REST HttpError, the Connect ConnectError and a Seiva/RFC-9457
// error envelope. `seivaErrors()` is an interceptor that applies this at the port
// boundary, so EVERY call over the transport yields a uniform SeivaError.

import type { Interceptor, Transport } from "@dxjs/transport";

export type SeivaErrorKind =
  | "validation"
  | "unauthorized"
  | "forbidden"
  | "conflict"
  | "not-found"
  | "rate-limit"
  | "server"
  | "network"
  | "unknown";

export interface SeivaError extends Error {
  name: "SeivaError";
  kind: SeivaErrorKind;
  /** HTTP status, when the failure came over HTTP. */
  status?: number;
  /** Stable error code from the envelope (code / type). */
  code?: string;
  /** Field-level validation errors, ready for @dxjs/forms. */
  fields?: Record<string, string>;
  /** W3C trace id for support correlation. */
  traceId?: string;
  /** Safe to retry (server/rate-limit/transient network). */
  retryable: boolean;
  /** The original thrown value. */
  cause?: unknown;
}

type Bag = Record<string, unknown>;
const isObj = (v: unknown): v is Bag => typeof v === "object" && v !== null;
const str = (v: unknown): string | undefined => (typeof v === "string" ? v : undefined);

function kindFromStatus(status: number): SeivaErrorKind {
  if (status === 400 || status === 422) return "validation";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "not-found";
  if (status === 409 || status === 412) return "conflict";
  if (status === 429) return "rate-limit";
  if (status >= 500) return "server";
  return "unknown";
}

// Connect/gRPC status code (string) → kind.
const CONNECT_KIND: Record<string, SeivaErrorKind> = {
  invalid_argument: "validation",
  unauthenticated: "unauthorized",
  permission_denied: "forbidden",
  not_found: "not-found",
  already_exists: "conflict",
  aborted: "conflict",
  failed_precondition: "conflict",
  resource_exhausted: "rate-limit",
  unavailable: "server",
  internal: "server",
  deadline_exceeded: "server",
};

/** Pull field errors from the common envelope shapes:
 *  { fields: {f: msg} } · { errors: {f: msg|[msg]} } (RFC-9457) · [{field,message}]. */
function extractFields(body: unknown): Record<string, string> | undefined {
  if (!isObj(body)) return undefined;
  const src = (isObj(body.fields) && body.fields) || (isObj(body.errors) && body.errors) || undefined;
  if (src) {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(src)) {
      const msg = Array.isArray(v) ? str(v[0]) : str(v);
      if (msg) out[k] = msg;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (Array.isArray(body.invalid)) {
    const out: Record<string, string> = {};
    for (const e of body.invalid) {
      if (isObj(e) && str(e.field)) out[str(e.field)!] = str(e.message) ?? "invalid";
    }
    return Object.keys(out).length ? out : undefined;
  }
  return undefined;
}

function message(body: unknown, fallback: string): string {
  if (isObj(body)) return str(body.detail) ?? str(body.message) ?? str(body.title) ?? fallback;
  return str(body) ?? fallback;
}

function make(partial: Omit<SeivaError, keyof Error | "name"> & { message: string; cause?: unknown }): SeivaError {
  const err = new Error(partial.message) as SeivaError;
  err.name = "SeivaError";
  err.kind = partial.kind;
  err.status = partial.status;
  err.code = partial.code;
  err.fields = partial.fields;
  err.traceId = partial.traceId;
  err.retryable = partial.retryable;
  err.cause = partial.cause;
  return err;
}

/** Normalize any thrown value into a SeivaError. */
export function toSeivaError(e: unknown): SeivaError {
  if (isObj(e) && e.name === "SeivaError") return e as unknown as SeivaError;

  // REST HttpError: { name:"HttpError", status, body }
  if (isObj(e) && e.name === "HttpError" && typeof e.status === "number") {
    const status = e.status;
    const kind = kindFromStatus(status);
    const body = e.body;
    return make({
      message: message(body, `HTTP ${status}`),
      kind,
      status,
      code: isObj(body) ? str(body.code) ?? str(body.type) : undefined,
      fields: extractFields(body),
      traceId: isObj(body) ? str(body.trace_id) ?? str(body.traceId) : undefined,
      retryable: kind === "server" || kind === "rate-limit",
      cause: e,
    });
  }

  // Connect/gRPC: { name:"ConnectError"|"GrpcError", code }
  if (isObj(e) && (e.name === "ConnectError" || e.name === "GrpcError")) {
    const code = str(e.code) ?? String(e.code ?? "");
    const kind = CONNECT_KIND[code] ?? "unknown";
    return make({
      message: str(e.message) ?? `rpc ${code}`,
      kind,
      code,
      retryable: kind === "server" || kind === "rate-limit",
      cause: e,
    });
  }

  // Network / abort (fetch TypeError, AbortError).
  if (isObj(e) && (e.name === "AbortError" || e.name === "TypeError")) {
    return make({
      message: str(e.message) ?? "network error",
      kind: "network",
      retryable: e.name === "TypeError",
      cause: e,
    });
  }

  return make({ message: isObj(e) && str(e.message) ? str(e.message)! : "unknown error", kind: "unknown", retryable: false, cause: e });
}

/** An interceptor that converts every thrown error over the transport into a
 *  SeivaError — uniform, structured errors regardless of adapter/protocol. */
export function seivaErrors(): Interceptor {
  return (next: Transport): Transport => ({
    caps: next.caps,
    async unary(m, req, ctx) {
      try {
        return await next.unary(m, req, ctx);
      } catch (e) {
        throw toSeivaError(e);
      }
    },
    async *serverStream(m, req, ctx) {
      try {
        yield* next.serverStream(m, req, ctx);
      } catch (e) {
        throw toSeivaError(e);
      }
    },
  });
}
