// @dxjs/stream/sources — adapters that bridge any push/pull producer into a
// StreamSource that streamFeed can consume.
//
// A StreamSource is deliberately tiny: subscribe(sink, ctl) starts producing and
// returns an unsubscribe that MUST stop production and release resources. The
// `ctl` lets a source report terminal error/completion. Every adapter guards a
// `closed` flag so a late async callback can never push after unsubscribe — the
// same "no write after teardown" discipline @dxjs/transport uses.

/** Terminal signals a source reports back to the feed. */
export interface StreamController {
  error(e: unknown): void;
  done(): void;
}

export interface StreamSource<T> {
  /** Start pushing items to `sink`; return an unsubscribe that stops & releases. */
  subscribe(sink: (item: T) => void, ctl: StreamController): () => void;
}

/** JSON.parse with a raw-string fallback — the house default for text frames. */
function defaultParse<T>(raw: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as unknown as T;
  }
}

/** Pull an AsyncIterable in a loop. Unsubscribe aborts an internal AbortController
 *  AND trips a flag checked each iteration, so the loop halts and never pushes after
 *  release — even if an in-flight next() resolves post-unsubscribe. */
export function fromAsyncIterable<T>(it: AsyncIterable<T>): StreamSource<T> {
  return {
    subscribe(sink, ctl): () => void {
      const ac = new AbortController();
      let stopped = false;
      void (async () => {
        const iterator = it[Symbol.asyncIterator]();
        try {
          while (!stopped) {
            const { value, done } = await iterator.next();
            if (stopped) break; // unsubscribe landed while awaiting — drop this result
            if (done) {
              ctl.done();
              return;
            }
            sink(value);
          }
        } catch (e) {
          if (!stopped) ctl.error(e);
        } finally {
          // We bailed early (unsubscribe): tell the iterator so it can release.
          if (stopped && iterator.return) {
            try {
              await iterator.return();
            } catch {
              /* best-effort */
            }
          }
        }
      })();
      return () => {
        stopped = true;
        ac.abort();
      };
    },
  };
}

/** Bridge DOM/Node events: addEventListener on subscribe, removeEventListener on
 *  unsubscribe. `map` projects each Event to an item. */
export function fromEventTarget<T>(target: EventTarget, event: string, map: (ev: Event) => T): StreamSource<T> {
  return {
    subscribe(sink): () => void {
      const handler = (ev: Event): void => sink(map(ev));
      target.addEventListener(event, handler);
      return () => target.removeEventListener(event, handler);
    },
  };
}

export interface WsSourceOptions<T> {
  /** Injectable WebSocket constructor for tests (defaults to the global). */
  WebSocket?: typeof WebSocket;
  protocols?: string | string[];
  /** Parse each text frame. Default: JSON.parse with raw-string fallback. */
  parse?: (raw: string) => T;
  /** Sent as JSON on open (e.g. a subscribe request so the server scopes the feed). */
  open?: unknown;
}

/** Open a WebSocket on subscribe; yield parse(data) per message; ctl.error on
 *  socket error, ctl.done on close. Unsubscribe closes the socket. Modeled on
 *  @dxjs/transport/ws but push-shaped (no async generator). */
export function fromWebSocket<T>(url: string, o: WsSourceOptions<T> = {}): StreamSource<T> {
  return {
    subscribe(sink, ctl): () => void {
      const WS = o.WebSocket ?? (globalThis as { WebSocket?: typeof WebSocket }).WebSocket;
      if (!WS) throw new Error("dxjs: no WebSocket available (pass o.WebSocket)");
      const parse = o.parse ?? defaultParse<T>;
      const ws = new WS(url, o.protocols);
      let closed = false;

      ws.onopen = (): void => {
        if (closed || o.open === undefined) return;
        try {
          ws.send(JSON.stringify(o.open));
        } catch {
          /* socket already closing */
        }
      };
      ws.onmessage = (ev: MessageEvent): void => {
        if (closed) return;
        sink(parse(String((ev as { data: unknown }).data)));
      };
      ws.onerror = (): void => {
        if (closed) return;
        ctl.error(new Error("dxjs: WebSocket error"));
      };
      ws.onclose = (): void => {
        if (closed) return;
        closed = true; // a close is terminal; no further pushes
        ctl.done();
      };

      return () => {
        if (closed) return;
        closed = true;
        try {
          ws.close();
        } catch {
          /* already closing/closed */
        }
      };
    },
  };
}

export interface SseSourceOptions<T> {
  /** Injectable EventSource constructor for tests (defaults to the global). */
  EventSource?: new (url: string) => EventSource;
  /** Named event to listen on. Default "message". */
  event?: string;
  /** Parse each event's data. Default: JSON.parse with raw-string fallback. */
  parse?: (raw: string) => T;
}

/** Open an EventSource on subscribe; yield parse(data) for each `event`; ctl.error
 *  on error. Unsubscribe removes listeners and closes the connection. */
export function fromEventSource<T>(url: string, o: SseSourceOptions<T> = {}): StreamSource<T> {
  return {
    subscribe(sink, ctl): () => void {
      const ES = o.EventSource ?? (globalThis as { EventSource?: new (url: string) => EventSource }).EventSource;
      if (!ES) throw new Error("dxjs: no EventSource available (pass o.EventSource)");
      const parse = o.parse ?? defaultParse<T>;
      const eventName = o.event ?? "message";
      const es = new ES(url);
      let closed = false;

      const onMessage = (ev: Event): void => {
        if (closed) return;
        sink(parse(String((ev as MessageEvent).data)));
      };
      const onError = (): void => {
        if (closed) return;
        // EventSource auto-reconnects on transient drops, firing 'error' with
        // readyState CONNECTING(0) while it retries. Only a CLOSED(2) connection is
        // terminal; otherwise ignore and let it reconnect — a network blip must not
        // permanently kill a feed meant to ingest THROUGH reconnects.
        if (es.readyState !== 2 /* CLOSED */) return;
        ctl.error(new Error("dxjs: EventSource error"));
      };
      es.addEventListener(eventName, onMessage);
      es.addEventListener("error", onError);

      return () => {
        if (closed) return;
        closed = true;
        es.removeEventListener(eventName, onMessage);
        es.removeEventListener("error", onError);
        es.close();
      };
    },
  };
}
