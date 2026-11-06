// VANILLA dxjs — hand-written JavaScript, shipped AS-IS (no TypeScript, no bundler,
// no build step for the author). It imports the single-file dxjs bundle same-origin
// and builds a reactive app. This is the proof that dxjs works "open an .html"
// vanilla, under the SAME strict CSP as every other proof (no eval, no inline).
import { signal, html, component, mount } from "./dxjs.js";

const Counter = component(() => {
  const n = signal(0);
  return html`
    <h1>dxjs — vanilla (no build)</h1>
    <button id="inc" @click=${() => n.update((x) => x + 1)}>n = ${() => n()}</button>
  `;
});

mount(Counter, document.getElementById("app"), {});
window.__dxready = true;
