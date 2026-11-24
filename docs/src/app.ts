// The dxjs documentation site — itself a dxjs app (dogfooding). The shell is
// @dxjs/ui's appShell; the sidebar lists the pages; the active page is MOUNTED into
// the content host (and disposed on switch), so each page gets real component
// context. The top bar carries a bilingual language switch (pt-AO ↔ en) and a
// light/dark theme toggle.
import { effect } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { component, mount, onMount } from "@dxjs/component";
import { appShell, createThemeController } from "@dxjs/ui";
import { pages } from "./pages.ts";
import { active, go } from "./store.ts";
import { langToggle, t } from "./i18n.ts";

const theme = createThemeController("system");

const navLabel = (pg: (typeof pages)[number]): string => (pg.labelKey ? t(pg.labelKey) : pg.label);

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

  const topbar = html`<div class="dx-topbar-tools">
    <span class="dx-topbar-tag">${() => t("shell.tagline")}</span>
    <span class="dx-spacer"></span>
    ${langToggle()}
    <button
      class="dx-btn is-icon"
      type="button"
      aria-label="Toggle theme"
      @click=${() => theme.toggle()}
    >${() => (theme.theme() === "dark" ? "☀" : "☾")}</button>
  </div>`;

  return appShell({
    brand: "dxjs",
    nav: () =>
      pages.map((pg) => ({
        label: navLabel(pg),
        active: active() === pg.id,
        onSelect: () => go(pg.id),
      })),
    topbar,
    content: html`<div id="doc-content"></div>`,
  });
});

mount(Docs, document.getElementById("app")!, {});
(window as unknown as { __dxready: boolean }).__dxready = true;
