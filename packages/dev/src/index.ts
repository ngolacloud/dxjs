// @dxjs/dev — a CSP-safe development server with HMR, built on @dxjs/edge.
// Development tool only: it runs in Node, but the product runtime it serves has
// NO Node dependency — the browser loads same-origin ES modules under a strict
// CSP. See ./server.ts and the README.

export { createDevServer, DEV_CSP } from "./server.ts";
export type { DevServer, DevServerOptions } from "./server.ts";
export type { DxHot } from "./client.ts";
