// Real .tsx compiled by esbuild (jsx=automatic, jsxImportSource=@dxjs/jsx) in
// run.mjs. Proves the end-to-end path: JSX syntax → jsx() calls → the @dxjs/dom
// renderer → live DOM with fine-grained reactivity. Exports a renderer rather
// than running on import, so the test controls when the DOM is touched.
import { signal } from "@dxjs/core";
import { mount } from "@dxjs/component";

export function renderApp(host: Element): () => void {
  const n = signal(0);
  const Counter = () => (
    <button class="counter" type="button" onClick={() => n.set(n() + 1)}>
      count: {() => n()}
    </button>
  );
  return mount(Counter, host, {});
}
