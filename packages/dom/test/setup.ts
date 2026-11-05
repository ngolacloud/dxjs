// Installs a DOM for node:test via happy-dom (dev-only). Imported first by the
// test files so `document` exists before the renderer runs. The real CSP proof
// runs in a browser (Playwright, F2); this verifies the binding/escape/teardown
// semantics against a standards DOM.
import { Window } from "happy-dom";

const win = new Window({ url: "https://local.test/" });
const g = globalThis as unknown as Record<string, unknown>;
g.window = win;
g.document = win.document;
g.Node = win.Node;
g.Element = win.Element;
g.HTMLElement = win.HTMLElement;
g.Event = win.Event;
g.CustomEvent = win.CustomEvent;

export function body(): Element {
  const host = win.document.createElement("div");
  win.document.body.appendChild(host);
  return host as unknown as Element;
}

export function fire(el: Element, type: string): void {
  el.dispatchEvent(new win.Event(type, { bubbles: true }));
}
