// examples/seiva-console — public surface.
//
// A self-contained reproduction of the Delonix Seiva "Console Admin" built on
// dxjs. Point it at a running Seiva backend (see README.md) or mount SeivaConsole
// yourself with a pre-built @dxjs/transport client.

import { createClient } from "@dxjs/transport";
import { mount } from "@dxjs/component";
import { SeivaConsole } from "./console.ts";

export { SeivaConsole } from "./console.ts";
export { loadRegistry, loadSpec, callOp } from "./api.ts";
export type { AdminResource, Registry, Can } from "./api.ts";
export {
  opsForResource,
  classifyOps,
  bodyFields,
} from "./contract.ts";
export type {
  OpenApiSpec,
  Operation,
  PathItem,
  JsonSchema,
  ClassifiedOp,
  Classified,
} from "./contract.ts";

export interface MountOptions {
  /** The Seiva origin, e.g. "" for same-origin or "https://app.example". */
  baseUrl?: string;
}

/**
 * Convenience bootstrap: build a @dxjs/transport client for `baseUrl` and mount
 * the console into `host`. Returns a disposer that tears everything down.
 */
export function mountConsole(host: Element, opts: MountOptions = {}): () => void {
  const client = createClient({ baseUrl: opts.baseUrl ?? "" });
  return mount(SeivaConsole, host, { client });
}
