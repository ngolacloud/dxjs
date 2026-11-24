// @dxjs/transport/sse — real-time per-component values over ONE shared SSE
// connection (multiplexed by named events/topics).
//
// A single EventSource per source URL carries every topic; the server pushes a
// delta only when something changes (no polling → near-zero idle load). Each
// `signal(topic)` returns a reactive value updated in place, so only the bound
// DOM node re-renders. Unsubscribing on owner dispose closes the connection when
// the last topic goes away.
//
// Resilience / resume: a native EventSource auto-reconnects on transient drops
// and replays the Last-Event-ID header itself. But once it gives up (readyState
// CLOSED) we must open a FRESH EventSource — and the browser forbids setting the
// Last-Event-ID header by hand. So we track the stream cursor (the id of the last
// applied event) and carry it in the reconnect URL (`?lastEventId=…`), letting a
// resume-aware server replay exactly what we missed. Each topic also remembers
// the id it last folded, so a server that redelivers the cursor event (inclusive
// resume) cannot double-count it — the delta-fold survives a reconnection without
// losing or duplicating an increment.

import { signal, onCleanup, type Accessor } from "@dxjs/core";

type ESCtor = new (url: string) => EventSource;

const CLOSED = 2; // EventSource.CLOSED

export interface LiveSourceConfig {
  /** Injectable EventSource (tests / non-browser). Defaults to global. */
  EventSource?: ESCtor;
  /** Query param carrying the resume cursor on a fresh reconnect (we cannot set
   *  the Last-Event-ID header by hand). Default "lastEventId". */
  resumeParam?: string;
}

export interface TopicOptions<T> {
  initial: T;
  /** Parse the raw event data. Default: JSON.parse. With `fold`, this yields a delta. */
  parse?: (raw: string) => unknown;
  /** Fold each incoming delta into the current value — the real-feed pattern
   * (servers push increments, not whole state). Without it, each event replaces. */
  fold?: (prev: T, delta: unknown) => T;
}

export interface LiveSource {
  /** A reactive signal fed by events named `topic` on the shared connection. */
  signal<T>(topic: string, options: TopicOptions<T>): Accessor<T>;
  /** Close the underlying connection (also happens automatically when idle). */
  close(): void;
}

/** Open (lazily) a multiplexed SSE source at `url`. */
export function createLiveSource(url: string, config: LiveSourceConfig = {}): LiveSource {
  const ES = config.EventSource ?? (globalThis as { EventSource?: ESCtor }).EventSource;
  if (!ES) throw new Error("dxjs: no EventSource available (pass config.EventSource)");
  const resumeParam = config.resumeParam ?? "lastEventId";

  let es: EventSource | null = null;
  let topicCount = 0;
  // Stream cursor: the id of the most recent applied event, replayed on reconnect.
  let lastEventId = "";
  // Every live topic binding, so a fresh connection can re-attach them all.
  const bindings: Array<{ topic: string; handler: (ev: Event) => void }> = [];

  const connect = (): EventSource => {
    const sep = url.includes("?") ? "&" : "?";
    const full = lastEventId ? `${url}${sep}${resumeParam}=${encodeURIComponent(lastEventId)}` : url;
    const conn = new ES(full);
    for (const b of bindings) conn.addEventListener(b.topic, b.handler);
    conn.onerror = (): void => {
      // While CONNECTING the native EventSource is retrying on its own (and will
      // send Last-Event-ID itself) — leave it be. Only when it has truly CLOSED
      // do we reopen a fresh connection carrying the resume cursor.
      if (conn.readyState === CLOSED && es === conn) {
        conn.close();
        es = null;
        if (topicCount > 0) es = connect();
      }
    };
    return conn;
  };

  const ensure = (): EventSource => (es ||= connect());

  return {
    signal<T>(topic: string, options: TopicOptions<T>): Accessor<T> {
      const s = signal<T>(options.initial);
      const parse = options.parse ?? ((raw: string): unknown => JSON.parse(raw));
      const fold = options.fold;
      // The id this topic last folded — guards against inclusive-resume redelivery.
      let topicLastId: string | undefined;
      const handler = (ev: Event): void => {
        const me = ev as MessageEvent;
        if (me.lastEventId && me.lastEventId === topicLastId) return; // already folded
        try {
          const delta = parse(me.data);
          s.update((prev) => (fold ? fold(prev, delta) : (delta as T)));
          if (me.lastEventId) {
            topicLastId = me.lastEventId;
            lastEventId = me.lastEventId;
          }
        } catch {
          /* ignore malformed frames */
        }
      };
      ensure().addEventListener(topic, handler);
      bindings.push({ topic, handler });
      topicCount++;
      onCleanup(() => {
        if (es) es.removeEventListener(topic, handler);
        const i = bindings.findIndex((b) => b.handler === handler);
        if (i >= 0) bindings.splice(i, 1);
        topicCount--;
        if (topicCount <= 0 && es) {
          es.close();
          es = null;
        }
      });
      return () => s();
    },
    close(): void {
      if (es) {
        es.close();
        es = null;
      }
      topicCount = 0;
      bindings.length = 0;
    },
  };
}
