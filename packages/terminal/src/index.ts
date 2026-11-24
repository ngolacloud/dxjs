// @dxjs/terminal — a resilient, CSP-safe web terminal.
//
// Output rides a @dxjs/transport LiveSource, so it inherits the SSE layer's
// reconnect/backoff/resume for free: when the connection drops and a resume-aware
// server replays missed events, the terminal catches up without losing or
// duplicating output. Rendering is a <pre> whose text goes through the safe
// textContent sink (escaped) and input is a plain <input> with an @keydown
// listener — no eval, no innerHTML, no inline handler → strict-CSP safe.
//
// Scope: a LINE-oriented terminal (scrollback + a command line). Full VT/ANSI
// cursor emulation, colors and xterm.js integration are out of scope.

import { signal, effect, type Accessor } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";

/** The slice of @dxjs/transport's LiveSource this component needs. */
export interface TerminalSource {
  signal<T>(
    topic: string,
    options: { initial: T; parse?: (raw: string) => unknown; fold?: (prev: T, delta: unknown) => T },
  ): Accessor<T>;
}

export interface TerminalOptions {
  /** Resilient output source (a @dxjs/transport LiveSource). Omit for a local
   *  terminal fed only via `write()`. */
  source?: TerminalSource;
  /** Event/topic carrying output chunks on the source. Default "output". */
  topic?: string;
  /** Receives a submitted input line (already newline-terminated). */
  onInput?: (data: string) => void;
  /** Echo submitted input into the scrollback (prefixed with "$ "). Default true. */
  echo?: boolean;
  /** Max scrollback lines kept; older lines drop off the top. Default 1000. */
  maxLines?: number;
}

export interface Terminal {
  /** Reactive visible lines (completed lines + the live partial last line). */
  lines: Accessor<string[]>;
  /** Feed raw output (handles partial lines and \r\n / lone \r). */
  write(chunk: string): void;
  /** Submit an input line: echo (if enabled) + call onInput with it + "\n". */
  input(line: string): void;
  /** Clear the scrollback. */
  clear(): void;
  /** The terminal view (output <pre> + command input). */
  view(): TemplateResult;
  /** Tear down the source subscription. */
  dispose(): void;
}

interface SeqChunk {
  seq: number;
  chunk: string;
}

/** Create a terminal. With `source`, output streams in resiliently over the
 *  LiveSource; without it, drive the terminal with `write()`. */
export function createTerminal(options: TerminalOptions = {}): Terminal {
  const maxLines = options.maxLines ?? 1000;
  const echo = options.echo ?? true;
  const linesSig = signal<string[]>([]);
  let completed: string[] = [];
  let pending = ""; // the current, not-yet-newline-terminated line

  const publish = (): void => {
    linesSig.set(pending ? [...completed, pending] : [...completed]);
  };

  const write = (chunk: string): void => {
    // Normalise newlines; a lone \r (cursor to column 0) just drops its line's
    // start for this line-oriented terminal — we keep it simple and strip it.
    const text = (pending + chunk).replace(/\r\n/g, "\n").replace(/\r/g, "");
    const parts = text.split("\n");
    pending = parts.pop() ?? "";
    for (const line of parts) completed.push(line);
    if (completed.length > maxLines) completed = completed.slice(completed.length - maxLines);
    publish();
  };

  const input = (line: string): void => {
    if (echo) write("$ " + line + "\n");
    options.onInput?.(line + "\n");
  };

  const clear = (): void => {
    completed = [];
    pending = "";
    publish();
  };

  // Resilient output feed. A seq-incrementing fold guarantees a NEW value for
  // every event (even an identical chunk), so the effect fires once per event —
  // and rides the LiveSource's reconnect/resume.
  let stop: (() => void) | null = null;
  if (options.source) {
    let lastSeq = 0;
    const feed = options.source.signal<SeqChunk>(options.topic ?? "output", {
      initial: { seq: 0, chunk: "" },
      parse: (raw) => raw,
      fold: (prev, delta) => ({ seq: prev.seq + 1, chunk: String(delta) }),
    });
    stop = effect(() => {
      const f = feed();
      if (f.seq !== lastSeq) {
        lastSeq = f.seq;
        write(f.chunk);
      }
    });
  }

  const onKey = (e: Event): void => {
    const ev = e as KeyboardEvent;
    if (ev.key !== "Enter") return;
    const el = ev.target as HTMLInputElement;
    const value = el.value;
    el.value = "";
    input(value);
  };

  const view = (): TemplateResult => html`<div class="dx-term">
    <pre class="dx-term-out" role="log" aria-label="Terminal output" aria-live="polite">${() =>
      linesSig().join("\n")}</pre>
    <input
      class="dx-term-in"
      aria-label="Terminal input"
      autocomplete="off"
      spellcheck="false"
      @keydown=${onKey}
    />
  </div>`;

  return {
    lines: () => linesSig(),
    write,
    input,
    clear,
    view,
    dispose(): void {
      if (stop) stop();
      stop = null;
    },
  };
}
