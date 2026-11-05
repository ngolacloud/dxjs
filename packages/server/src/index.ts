// @dxjs/server — SSR + (basic) hydration. See ../../../DESIGN.md (§8).
// Fine-grained attach-hydration is a later increment; `hydrate` currently
// clears the host and mounts (correct output, with a render on load).

import { render, type TemplateResult } from "@dxjs/dom";

export { renderToString } from "./render.ts";

/**
 * Attach a view to a server-rendered host. For now this clears and re-renders
 * (replace hydration) — correct and CSP-safe; fine-grained attach is next.
 */
export function hydrate(view: TemplateResult, host: Element): () => void {
  host.textContent = "";
  return render(view, host);
}
