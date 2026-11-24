// @dxjs/jsx — optional, type-safe JSX for dxjs that compiles to the existing
// reactive renderer (no VDOM, no eval, CSP-safe) and interleaves with html`…`.
//
// Wire a project with:
//   "jsx": "react-jsx", "jsxImportSource": "@dxjs/jsx"
// then author `(props) => <div class={() => cls()}>{child}</div>`. See README.md.
//
// This barrel re-exports the runtime surface (jsx/jsxs/Fragment) and the `JSX`
// type namespace; the JSX transform itself imports "@dxjs/jsx/jsx-runtime".

export * from "./jsx-runtime.ts";
