// @dxjs/jsx/jsx-dev-runtime — the dev-mode entry (`"jsx": "react-jsxdev"`).
// Same descriptor construction as the production runtime; the extra dev args
// (source position, self) are accepted and ignored. Re-exports the production
// surface — including the `JSX` type namespace — so type-checking is identical.

import { jsxElement } from "@dxjs/dom";
import type { ElementResult } from "@dxjs/dom";

export * from "./jsx-runtime.ts";

export function jsxDEV(type: ElementResult["type"], props: Record<string, unknown> | null): ElementResult {
  return jsxElement(type, props);
}
