// @dxjs/edge/grpc — a native gRPC unary client over `node:http2`.
//
// This is the capability a browser CANNOT provide: reading HTTP/2 trailers
// (`grpc-status` / `grpc-message`). A browser's fetch exposes no trailer API,
// which is why in the browser dxjs speaks Connect (see @dxjs/transport). When
// dxjs runs on a server/edge co-located with a gRPC backend, use this native
// client — no proxy, no transcoding.
//
// Codec note: payloads are OPAQUE bytes (Uint8Array). Bring your own encoder
// (protobuf, flatbuffers, JSON-as-bytes, ...); the channel is codec-agnostic.
// It only owns the gRPC length-prefixed framing and the HTTP/2 transport.

import * as http2 from "node:http2";

export interface GrpcChannelOptions {
  /** Base URL of the HTTP/2 authority, e.g. "http://127.0.0.1:50051". */
  url: string;
  /**
   * Optional injection seam for tests/alternate transports. When absent the
   * channel uses `node:http2` directly. The shape mirrors the slice of
   * `http2.connect` this client relies on.
   */
  fetchImpl?: typeof http2.connect;
  /**
   * Reuse ONE HTTP/2 session across unary calls (multiplexed) instead of opening
   * and closing a session per call. Reconnects if the session closes/errors. When
   * enabled you MUST call `close()` to release the pooled session. Default false
   * (stateless per-call — no lifecycle to manage). (Audit L11)
   */
  keepAlive?: boolean;
}

export interface GrpcUnaryOptions {
  /** Abort the call after this many milliseconds (gRPC deadline). */
  deadlineMs?: number;
}

export interface GrpcError extends Error {
  /** Numeric gRPC status code from the `grpc-status` trailer. */
  code: number;
  /** Human-readable detail from the `grpc-message` trailer, if any. */
  details: string;
}

export interface GrpcChannel {
  unary(
    service: string,
    method: string,
    bytes: Uint8Array,
    opts?: GrpcUnaryOptions,
  ): Promise<Uint8Array>;
  /** Release the pooled HTTP/2 session (only meaningful with `keepAlive`). (L11) */
  close?(): void;
}

function grpcError(code: number, details: string): GrpcError {
  const err = new Error(`gRPC error ${code}: ${details || "(no details)"}`) as GrpcError;
  err.name = "GrpcError";
  err.code = code;
  err.details = details;
  return err;
}

/** Frame a payload as a single gRPC length-prefixed message: flag + len + data. */
function frame(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(5 + payload.byteLength);
  out[0] = 0; // compression flag: 0 = identity (uncompressed)
  const view = new DataView(out.buffer);
  view.setUint32(1, payload.byteLength, false); // big-endian length
  out.set(payload, 5);
  return out;
}

/** Parse the first length-prefixed message out of a concatenated buffer. */
function deframe(buf: Uint8Array): Uint8Array {
  if (buf.byteLength < 5) {
    throw grpcError(13, "short gRPC frame (missing 5-byte prefix)");
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const length = view.getUint32(1, false);
  const end = 5 + length;
  if (buf.byteLength < end) {
    throw grpcError(13, "truncated gRPC message body");
  }
  return buf.slice(5, end);
}

/**
 * Create a native gRPC unary channel. Each `unary` call opens an HTTP/2
 * request against `url`, POSTs one length-prefixed frame to
 * `/${service}/${method}`, reads the length-prefixed response and inspects the
 * `grpc-status` trailer. A non-"0" status rejects with a `GrpcError` carrying
 * `.code` (numeric) and `.details`.
 */
export function createGrpcChannel(options: GrpcChannelOptions): GrpcChannel {
  const connect = options.fetchImpl ?? http2.connect;
  const keepAlive = options.keepAlive ?? false;

  // With keepAlive, one session is reused across calls (reconnected if it drops);
  // without it, each call gets its own session, closed when the call settles. (L11)
  let pooled: ReturnType<typeof connect> | null = null;
  const acquire = (): ReturnType<typeof connect> => {
    if (!keepAlive) return connect(options.url);
    if (pooled && !pooled.closed && !pooled.destroyed) return pooled;
    const s = connect(options.url);
    pooled = s;
    // Each in-flight call adds its own transient 'error' listener (removed on
    // settle). Concurrent multiplexed calls can exceed the default-10 cap and emit
    // a spurious MaxListenersExceededWarning — the listeners are bounded and cleaned
    // up, so lift the cap on the pooled session. (L11 review)
    s.setMaxListeners?.(0);
    const drop = (): void => {
      if (pooled === s) pooled = null;
    };
    s.on("close", drop);
    s.on("error", drop);
    return s;
  };

  return {
    close(): void {
      if (pooled) {
        pooled.close();
        pooled = null;
      }
    },
    unary(service, method, bytes, opts: GrpcUnaryOptions = {}): Promise<Uint8Array> {
      return new Promise<Uint8Array>((resolve, reject) => {
        const session = acquire();
        let settled = false;

        const onSessionError = (err: Error): void => finish(() => reject(err));
        const finish = (fn: () => void): void => {
          if (settled) return;
          settled = true;
          fn();
          session.removeListener("error", onSessionError);
          // Close the SESSION only when not pooling; a pooled session is reused
          // across calls (its per-call streams close on their own) until close().
          if (!keepAlive) session.close();
        };

        session.on("error", onSessionError);

        const headers: http2.OutgoingHttpHeaders = {
          ":method": "POST",
          ":path": `/${service}/${method}`,
          "content-type": "application/grpc+proto",
          te: "trailers",
        };

        const stream = session.request(headers);

        if (opts.deadlineMs !== undefined) {
          stream.setTimeout(opts.deadlineMs, () => {
            stream.close();
            finish(() => reject(grpcError(4, "deadline exceeded")));
          });
        }

        // gRPC status may arrive as trailers (common) or, for trailers-only
        // responses, folded into the HEADERS frame. Capture both.
        let headerStatus: string | undefined;
        let headerMessage: string | undefined;
        let trailerStatus: string | undefined;
        let trailerMessage: string | undefined;

        stream.on("response", (resHeaders) => {
          const s = resHeaders["grpc-status"];
          if (s !== undefined) headerStatus = String(s);
          const m = resHeaders["grpc-message"];
          if (m !== undefined) headerMessage = decodeURIComponent(String(m));
        });

        stream.on("trailers", (trailers) => {
          const s = trailers["grpc-status"];
          if (s !== undefined) trailerStatus = String(s);
          const m = trailers["grpc-message"];
          if (m !== undefined) trailerMessage = decodeURIComponent(String(m));
        });

        const chunks: Uint8Array[] = [];
        stream.on("data", (chunk: Uint8Array) => chunks.push(chunk));
        stream.on("error", (err) => finish(() => reject(err)));

        stream.on("end", () => {
          finish(() => {
            const status = trailerStatus ?? headerStatus;
            const message = trailerMessage ?? headerMessage ?? "";

            if (status !== undefined && status !== "0") {
              reject(grpcError(Number(status), message));
              return;
            }

            const body = chunks.length ? concat(chunks) : new Uint8Array(0);
            // A successful call with no message body is valid (empty payload).
            if (body.byteLength === 0) {
              resolve(new Uint8Array(0));
              return;
            }
            try {
              resolve(deframe(body));
            } catch (e) {
              reject(e as Error);
            }
          });
        });

        stream.end(frame(bytes));
      });
    },
  };
}

function concat(chunks: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const c of chunks) total += c.byteLength;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}
