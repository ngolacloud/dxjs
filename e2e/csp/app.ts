// A real dxjs app, bundled and served under a STRICT CSP (script-src 'self',
// no unsafe-eval / no unsafe-inline). If dxjs needed eval or inline handlers,
// this would not run — which is exactly what the Playwright test asserts.
import { signal } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { component, mount, createRouter } from "@dxjs/component";

const Counter = component(() => {
  const n = signal(0);
  // data value that would be XSS if rendered unsafely:
  const danger = signal('<img src=x onerror="window.__xss=1">');
  return html`
    <section>
      <button id="inc" @click=${() => n.update((x) => x + 1)}>n = ${() => n()}</button>
      <p id="danger">${() => danger()}</p>
    </section>`;
});

const app = document.getElementById("app")!;
mount(Counter, app, {});

// Exercise the router too (History API, no eval).
const router = createRouter([{ path: "/", component: Counter }]);
void router;

// Signal readiness for the test.
(window as unknown as { __dxready: boolean }).__dxready = true;
