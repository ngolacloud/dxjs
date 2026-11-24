// hmr-counter — the smallest honest proof of dxjs HMR with signal preservation.
//
// Run it:  npm run dev   (→ packages/dev/bin/dxdev.mjs pointed here)
// Then click +, edit the <h1> text below, save: the heading updates WITHOUT a
// full reload and the counter keeps its value (the signal survives the swap).
import { signal, type Signal } from "@dxjs/core";
import { html, render, type TemplateResult } from "@dxjs/dom";

// The dev server injects `import.meta.hot`; in a production build it is absent.
interface Hot {
  readonly data: Record<string, unknown>;
  accept(cb?: (mod: unknown) => void): void;
}
const hot = (import.meta as unknown as { hot?: Hot }).hot;
const store = (hot?.data ?? {}) as { count?: Signal<number>; dispose?: () => void };

const host = document.getElementById("app")!;

// State that OUTLIVES an edit: the signal lives in the hot data bag (owned by the
// HMR client, keyed by module id). A markup edit re-runs THIS module but reuses
// the existing signal — so the counter keeps its value instead of resetting to 0.
const count = (store.count ??= signal(0));

// On an HMR re-run, tear down the previous render before drawing the new markup.
store.dispose?.();

const view = (): TemplateResult => html`
  <main class="counter">
    <h1>dxjs HMR — edit this heading</h1>
    <p class="hint">Click +, then change the h1 text and save — the count survives.</p>
    <button id="inc" @click=${() => count((c) => c + 1)}>count = ${() => count()}</button>
  </main>
`;

store.dispose = render(view(), host);
(window as unknown as { __dxready: boolean }).__dxready = true;

// Self-accepting module: on update the dev client re-imports it (this top-level
// re-runs), reusing `count` from the hot data bag.
hot?.accept();
