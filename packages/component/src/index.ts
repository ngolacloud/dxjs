// @dxjs/component — a thin component + lifecycle layer over @dxjs/dom.
//
// A component is a plain function `(props) => TemplateResult`, run ONCE inside a
// reactive owner; reactivity lives in signals, not in re-running the component.
// `mount` renders it and returns a disposer that tears everything down. `onMount`
// runs after the nodes are in the DOM and may return a cleanup. See DESIGN.md §6.
// (Router is the next increment.)

import { createRoot, onCleanup } from "@dxjs/core";
import { render, type TemplateResult } from "@dxjs/dom";

export type Component<P = Record<string, never>> = (props: P) => TemplateResult;

type MountCb = () => void | (() => void);
let currentMounts: MountCb[] | null = null;

/** Identity helper that types a function as a dxjs component. */
export function component<P>(fn: Component<P>): Component<P> {
  return fn;
}

/**
 * Register a callback to run once the component's nodes are in the DOM. It may
 * return a cleanup function (run on dispose). Outside a `mount`, runs eagerly.
 */
export function onMount(fn: MountCb): void {
  if (currentMounts) currentMounts.push(fn);
  else {
    const c = fn();
    if (typeof c === "function") onCleanup(c);
  }
}

/** Mount a component into `host`. Returns a disposer (idempotent). */
export function mount<P>(comp: Component<P>, host: Element, props: P): () => void {
  return createRoot((dispose) => {
    const collected: MountCb[] = [];
    const prev = currentMounts;
    currentMounts = collected;
    let view: TemplateResult;
    try {
      view = comp(props);
    } finally {
      currentMounts = prev;
    }
    const disposeView = render(view, host);
    onCleanup(disposeView);
    for (const cb of collected) {
      const c = cb();
      if (typeof c === "function") onCleanup(c);
    }
    return dispose;
  });
}

export { onCleanup } from "@dxjs/core";

export {
  createRouter,
  type Router,
  type Route,
  type RouteContext,
  type RouterOptions,
  type Guard,
  type Match,
} from "./router.ts";
