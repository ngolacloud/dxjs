// @dxjs/server — SSR string + streaming rendering, Suspense/error boundaries, and
// fine-grained hydration. See DESIGN.md §8.

export {
  renderToString,
  renderToStringAsync,
  renderToStream,
  renderToChunks,
  renderToStreamOOO,
  renderToChunksOOO,
  suspense,
  errorBoundary,
  planParts,
  type RenderOptions,
  type StreamOptions,
  type SuspenseResult,
  type ErrorBoundaryResult,
} from "./render.ts";
export { installStreamClient, swapStreamSlots, swapStreamTemplate } from "./stream-client.ts";
export { hydrate, hydrateReplace } from "./hydrate.ts";
