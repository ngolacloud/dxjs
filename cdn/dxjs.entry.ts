// CDN / vanilla entry: the everyday dxjs surface in ONE ESM file for direct
// browser use with NO bundler. Built by scripts/build.mjs → cdn/dxjs.js.
//
// Usage (no build step):
//   <script type="module">
//     import { signal, html, component, mount, appShell } from "./dxjs.js";
//   </script>
//
// Or keep bare @dxjs/* specifiers via an import map (see docs/getting-started):
//   <script type="importmap">{"imports":{
//     "@dxjs/core":"./dxjs.js","@dxjs/dom":"./dxjs.js",
//     "@dxjs/component":"./dxjs.js","@dxjs/ui":"./dxjs.js"}}</script>
export * from "@dxjs/core";
export * from "@dxjs/dom";
export * from "@dxjs/component";
export * from "@dxjs/ui";
