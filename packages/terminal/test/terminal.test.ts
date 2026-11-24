import { body } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot } from "@dxjs/core";
import { html, render } from "@dxjs/dom";
import { createLiveSource } from "../../transport/src/index.ts";
import { createTerminal } from "../src/index.ts";

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  closed = false;
  listeners: Record<string, Array<(e: unknown) => void>> = {};
  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
  addEventListener(type: string, h: (e: unknown) => void): void {
    (this.listeners[type] ||= []).push(h);
  }
  removeEventListener(type: string, h: (e: unknown) => void): void {
    this.listeners[type] = (this.listeners[type] || []).filter((x) => x !== h);
  }
  emit(type: string, data: string): void {
    for (const h of this.listeners[type] || []) h({ data });
  }
  close(): void {
    this.closed = true;
  }
}

test("output over a LiveSource feeds the buffer: line-split, repeats land, escaped render", () => {
  FakeEventSource.instances = [];
  createRoot((dispose) => {
    const live = createLiveSource("/pty", { EventSource: FakeEventSource as unknown as typeof EventSource });
    const term = createTerminal({ source: live, topic: "output", echo: false });
    const host = body();
    render(html`${() => term.view()}`, host);
    const es = FakeEventSource.instances[0]!;

    es.emit("output", "hello\n");
    es.emit("output", "world\n");
    assert.deepEqual(term.lines(), ["hello", "world"]);

    // A partial line (no newline) shows as the live last line.
    es.emit("output", "par");
    es.emit("output", "tial\n");
    assert.deepEqual(term.lines(), ["hello", "world", "partial"]);

    // Two IDENTICAL chunks must BOTH land (seq-fold, not value-dedup).
    es.emit("output", "dup\n");
    es.emit("output", "dup\n");
    assert.deepEqual(term.lines().slice(-2), ["dup", "dup"], "repeated output not swallowed");

    // Output is rendered escaped (textContent) — no HTML injection.
    es.emit("output", "<img src=x onerror=alert(1)>\n");
    assert.equal(host.querySelector("img"), null, "output must not become an element");
    assert.ok(host.querySelector(".dx-term-out")!.textContent!.includes("<img"), "shown as text");
    term.dispose();
    dispose();
  });
});

test("scrollback is capped (ring buffer)", () => {
  const term = createTerminal({ maxLines: 3 });
  for (let i = 0; i < 10; i++) term.write(`line ${i}\n`);
  assert.deepEqual(term.lines(), ["line 7", "line 8", "line 9"], "only the last maxLines kept");
});

test("submitting input echoes it and calls onInput, interleaved with live output", () => {
  FakeEventSource.instances = [];
  createRoot((dispose) => {
    const sent: string[] = [];
    // The source IS a @dxjs/transport LiveSource — the terminal inherits its
    // reconnect/backoff/resume (that resilience is proven in transport's own
    // sse.test.ts). Here we prove input + interleaving with resilient output.
    const live = createLiveSource("/pty", { EventSource: FakeEventSource as unknown as typeof EventSource });
    const term = createTerminal({ source: live, topic: "output", onInput: (d) => sent.push(d) });
    const host = body();
    render(html`${() => term.view()}`, host);
    const es = FakeEventSource.instances[0]!;

    es.emit("output", "welcome\n");

    // Type a command and press Enter.
    const inputEl = host.querySelector(".dx-term-in") as HTMLInputElement;
    inputEl.value = "ls -la";
    inputEl.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    assert.deepEqual(sent, ["ls -la\n"], "onInput got the newline-terminated line");
    assert.equal(inputEl.value, "", "input cleared after submit");

    // Server responds; output interleaves with the echoed command.
    es.emit("output", "total 0\n");
    assert.deepEqual(term.lines(), ["welcome", "$ ls -la", "total 0"]);
    term.dispose();
    dispose();
  });
});
