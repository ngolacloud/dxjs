// @dxjs/transport/sse — real-time per-component values over ONE shared SSE
// connection (multiplexed by named events/topics).
//
// A single EventSource per source URL carries every topic; the server pushes a
// delta only when something changes (no polling → near-zero idle load). Each
// `signal(topic)` returns a reactive value updated in place, so only the bound
// DOM node re-renders. Unsubscribing on owner dispose closes the connection when
// the last topic goes away.

import { signal, onCleanup, type Accessor } from "@dxjs/core";

type ESCtor = new (url: string) => EventSource;

export interface LiveSourceConfig {
  /** Injectable EventSource (tests / non-browser). Defaults to global. */
  EventSource?: ESCtor;
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
  let es: EventSource | null = null;
  let topicCount = 0;

  const ensure = (): EventSource => (es ||= new ES(url));

  return {
    signal<T>(topic: string, options: TopicOptions<T>): Accessor<T> {
      const s = signal<T>(options.initial);
      const parse = options.parse ?? ((raw: string): unknown => JSON.parse(raw));
      const fold = options.fold;
      const conn = ensure();
      const handler = (ev: Event): void => {
        try {
          const delta = parse((ev as MessageEvent).data);
          s.update((prev) => (fold ? fold(prev, delta) : (delta as T)));
        } catch {
          /* ignore malformed frames */
        }
      };
      conn.addEventListener(topic, handler);
      topicCount++;
      onCleanup(() => {
        conn.removeEventListener(topic, handler);
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
    },
  };
}
