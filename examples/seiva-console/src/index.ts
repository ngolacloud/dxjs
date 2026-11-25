// examples/seiva-console — public surface.
//
// A self-contained reproduction of the Delonix Seiva "Console Admin" built on
// dxjs. Point it at a running Seiva backend (see README.md) or mount SeivaConsole
// yourself with a pre-built @dxjs/transport Transport.

import { restAdapter, withInterceptors } from "@dxjs/transport";
import { seivaErrors } from "@dxjs/seiva";
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
 * Convenience bootstrap: build the transport (REST adapter + the @dxjs/seiva error
 * profile) for `baseUrl` and mount the console into `host`. Swap restAdapter for
 * embeddedAdapter to run the same console in-process. Returns a disposer.
 */
export function mountConsole(host: Element, opts: MountOptions = {}): () => void {
  const transport = withInterceptors(restAdapter({ baseUrl: opts.baseUrl ?? "" }), seivaErrors());
  return mount(SeivaConsole, host, { transport });
}
