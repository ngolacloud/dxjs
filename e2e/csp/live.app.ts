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
  // A folded accumulator: the server pushes DELTAS, the client folds a running total.
  const total = live.signal<number>("delta", { initial: 0, fold: (prev, d) => prev + (d as number) });
  return html`
    <div>
      <p id="ticker">ticker=${() => ticker()}</p>
      <p id="status">status=${() => status()}</p>
      <p id="total">total=${() => total()}</p>
    </div>`;
});

mount(App, document.getElementById("app")!, {});
(window as unknown as { __dxready: boolean }).__dxready = true;
