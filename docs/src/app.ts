// The dxjs documentation site — itself a dxjs app (dogfooding). The shell is
// @dxjs/ui's appShell; the sidebar lists the pages; the active page is MOUNTED
// into the content host (and disposed on switch), so each page gets real component
// context — that's how the charts page's onMount fires once its canvas is visible.
import { signal, effect } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { component, mount, onMount } from "@dxjs/component";
import { appShell } from "@dxjs/ui";
import { pages } from "./pages.ts";

const active = signal(pages[0]!.id);

const Docs = component(() => {
  // Re-mount the active page into #doc-content whenever the selection changes,
  // disposing the previous one (charts destroyed, effects torn down).
  onMount(() => {
    const host = document.getElementById("doc-content");
    if (!host) return;
    let dispose = (): void => {};
    const stop = effect(() => {
      const pg = pages.find((x) => x.id === active()) ?? pages[0]!;
      dispose();
      dispose = mount(pg.view, host, {});
    });
    return () => {
      stop();
      dispose();
    };
  });

  return appShell({
    brand: "dxjs",
    nav: () =>
      pages.map((pg) => ({
        label: pg.label,
        active: active() === pg.id,
        onSelect: () => active.set(pg.id),
      })),
    user: { name: "docs", initials: "dx" },
    content: html`<div id="doc-content"></div>`,
  });
});

mount(Docs, document.getElementById("app")!, {});
(window as unknown as { __dxready: boolean }).__dxready = true;
