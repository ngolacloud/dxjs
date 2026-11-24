// @dxjs/server/stream-client — the browser side of out-of-order streaming SSR.
//
// The server (`renderToStreamOOO`) flushes the shell with
// `<dxs-slot data-dxs="N">fallback</dxs-slot>` placeholders, then streams each
// boundary's content as `<template data-dxs-content="N">…</template>`. This client
// moves each template's content into the matching slot the moment it arrives.
//
// It is plain DOM manipulation (querySelector + replaceChildren + a
// MutationObserver) — no eval, no inline handler, no innerHTML of data. The
// consumer bundles it into their own client entry, so it loads under
// `script-src 'self'`: out-of-order streaming WITHOUT an inline swap script.

type Root = Document | Element;

function resolveRoot(root?: Root): Root | null {
  if (root) return root;
  return (globalThis as { document?: Document }).document ?? null;
}

/** Move one `<template data-dxs-content="N">`'s content into its slot and drop
 *  the template. Exported for testing/manual use. */
export function swapStreamTemplate(tpl: HTMLTemplateElement, root?: Root): boolean {
  const scope = resolveRoot(root);
  if (!scope) return false;
  const id = tpl.getAttribute("data-dxs-content");
  if (!id) return false;
  const slot = scope.querySelector(`dxs-slot[data-dxs="${id}"]`);
  if (slot) slot.replaceChildren(tpl.content.cloneNode(true));
  tpl.remove();
  return !!slot;
}

/** Swap every streamed template currently present under `root` (the initial
 *  pass; the observer handles later arrivals). Returns how many were swapped. */
export function swapStreamSlots(root?: Root): number {
  const scope = resolveRoot(root);
  if (!scope) return 0;
  let n = 0;
  for (const tpl of scope.querySelectorAll("template[data-dxs-content]")) {
    if (swapStreamTemplate(tpl as HTMLTemplateElement, scope)) n++;
  }
  return n;
}

/** Install the out-of-order streaming client: swap what is already here, then
 *  watch for streamed templates and swap each as it is parsed in. Returns a
 *  disposer that stops the observer. */
export function installStreamClient(root?: Root): () => void {
  const scope = resolveRoot(root);
  if (!scope) return () => {};
  swapStreamSlots(scope);
  const target = (scope as Document).documentElement ?? (scope as Element);
  const Observer = (globalThis as { MutationObserver?: typeof MutationObserver }).MutationObserver;
  if (!Observer) return () => {};
  const observer = new Observer((records) => {
    for (const rec of records) {
      for (const node of rec.addedNodes) {
        const el = node as Element;
        if (el.nodeType === 1 && el.tagName === "TEMPLATE" && el.hasAttribute("data-dxs-content")) {
          swapStreamTemplate(el as HTMLTemplateElement, scope);
        }
      }
    }
  });
  observer.observe(target, { childList: true, subtree: true });
  return () => observer.disconnect();
}
