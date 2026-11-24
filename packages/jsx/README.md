# @dxjs/jsx

Optional, **type-safe JSX** for dxjs. `<tags/>` compile to the existing reactive
renderer in `@dxjs/dom` — **no virtual DOM, no `eval`, no inline handlers** →
runs under a strict CSP. JSX is an *option*, not a replacement: it interleaves
freely with `` html`…` ``.

## Wire it up

In `tsconfig.json`:

```jsonc
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@dxjs/jsx"
  }
}
```

and tell your bundler the same. With esbuild:

```js
build({ jsx: "automatic", jsxImportSource: "@dxjs/jsx", /* … */ });
```

## Author

```tsx
import { signal } from "@dxjs/core";
import { mount } from "@dxjs/component";

function Counter() {
  const n = signal(0);
  return (
    <button class="btn" onClick={() => n.set(n() + 1)}>
      count: {() => n()}
    </button>
  );
}

mount(Counter, document.body, {});
```

- **Reactive values** are accessors: `class={() => cls()}`, `{() => n()}` as a
  child. They bind through a fine-grained effect, so only the touched node
  updates.
- **Events**: `onClick`, `onInput`, `onKeyDown`, … (or `on:click`) →
  `addEventListener` (never an inline `on*=` attribute).
- **`value` / `checked` / `selected`** bind as live DOM *properties*; everything
  else is a safe, escaped attribute.
- **`ref={(el) => …}`** hands you the element; **`style={{ color: "red" }}`**
  accepts an object or a string.
- **Lists**: use `@dxjs/dom`'s `list(items, key, render)` as a child for keyed
  reconciliation.

## How it works

`jsx(type, props)` returns a light **descriptor** (`ElementResult`). The single
renderer in `@dxjs/dom` realizes it **once** into DOM and wires reactive effects —
the same path as `` html`…` ``. There is no diffing; reactivity lives in signals.

## Scope (v0.0.1)

Client-side rendering. SSR/hydration of JSX and exhaustive HTML/SVG attribute
typings are tracked in the dxjs Track-A campaign (S6 and follow-ups). Unlisted
tags are permitted (custom elements) and still type-check shared attributes.
