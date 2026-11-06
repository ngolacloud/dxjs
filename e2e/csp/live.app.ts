// A dxjs real-time app: two values fed by ONE multiplexed SSE connection
// (createLiveSource), each bound to its own DOM node. Served under the strict
// CSP (connect-src 'self' permits the same-origin EventSource). Proves per-
// component real-time updates with a single connection and server push-only.
import { html } from "@dxjs/dom";
import { component, mount } from "@dxjs/component";
import { createLiveSource } from "@dxjs/transport";

const live = createLiveSource("/events");

const App = component(() => {
  const ticker = live.signal<number>("ticker", { initial: 0 });
  const status = live.signal<string>("status", { initial: "unknown" });
  return html`
    <div>
      <p id="ticker">ticker=${() => ticker()}</p>
      <p id="status">status=${() => status()}</p>
    </div>`;
});

mount(App, document.getElementById("app")!, {});
(window as unknown as { __dxready: boolean }).__dxready = true;
