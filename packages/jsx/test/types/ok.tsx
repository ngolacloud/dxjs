// Positive type fixture: every construct here MUST type-check clean. Compiled by
// `npm run gate:jsx-types` with jsx=react-jsx, jsxImportSource=@dxjs/jsx and the
// `development` condition (so @dxjs/jsx + @dxjs/dom resolve to source).
import { signal } from "@dxjs/core";
import { html, list } from "@dxjs/dom";
import type { JSX } from "@dxjs/jsx";

const n = signal(0);

function Badge(props: { label: string; tone?: string }): JSX.Element {
  return <span class={`badge ${props.tone ?? ""}`}>{props.label}</span>;
}

export const view: JSX.Element = (
  <div class="root" tabindex={0} data-testid="root" aria-label="root">
    <h1 id="title">dashboard</h1>
    <button type="button" onClick={() => n.set(n() + 1)} disabled={false}>
      count: {() => n()}
    </button>
    <input type="text" value={() => String(n())} placeholder="search" required />
    <a href="/nodes" rel="noopener" target="_blank">
      nodes
    </a>
    <Badge label="online" tone="pos" />
    <>{html`<em>html interop inside JSX</em>`}</>
    <ul>
      {list(
        () => [{ id: 1 }, { id: 2 }],
        (i) => i.id,
        (i) => html`<li>${i.id}</li>`,
      )}
    </ul>
  </div>
);
