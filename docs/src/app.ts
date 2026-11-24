// The dxjs documentation site — a dxjs app (dogfooding) in the DELONIX docs style:
// a sticky topbar (brand + language + theme), a light grouped sidebar, the content
// column, and a right "on this page" TOC built from the mounted page's headings.
import { signal, effect } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { component, mount, onMount } from "@dxjs/component";
import { createThemeController } from "@dxjs/ui";
import { pages, type Page } from "./pages.ts";
import { active, go } from "./store.ts";
import { langToggle, t } from "./i18n.ts";

const theme = createThemeController("system");
const navOpen = signal(false); // mobile drawer
const toc = signal<Array<{ id: string; text: string }>>([]);

const GROUP_ORDER = ["Start", "Guide", "Componentes", "Packages", "Learn"];
const groupLabelKey: Record<string, string> = {
  Start: "nav.groupStart",
  Guide: "nav.groupGuide",
  Componentes: "nav.groupComponents",
  Packages: "nav.groupPackages",
  Learn: "nav.groupLearn",
};

function grouped(): Array<{ group: string; items: Page[] }> {
  const by = new Map<string, Page[]>();
  for (const pg of pages) (by.get(pg.group) ?? by.set(pg.group, []).get(pg.group)!).push(pg);
  const keys = [...by.keys()].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a);
    const ib = GROUP_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  return keys.map((group) => ({ group, items: by.get(group)! }));
}

const navLabel = (pg: Page): string => (pg.labelKey ? t(pg.labelKey) : pg.label);

const Docs = component(() => {
  onMount(() => {
    const host = document.getElementById("doc-content");
    if (!host) return;
    let dispose = (): void => {};
    const stop = effect(() => {
      const pg = pages.find((x) => x.id === active()) ?? pages[0]!;
      dispose();
      dispose = mount(pg.view, host, {});
      navOpen.set(false);
      // Build the right-hand TOC from the page's section headings.
      const hs = [...host.querySelectorAll(".doc-h2")] as HTMLElement[];
      toc.set(
        hs.map((el, i) => {
          if (!el.id) el.id = `sec-${i}`;
          return { id: el.id, text: el.textContent ?? "" };
        }),
      );
      host.scrollTop = 0;
      (globalThis as { scrollTo?: (x: number, y: number) => void }).scrollTo?.(0, 0);
    });
    return () => {
      stop();
      dispose();
    };
  });

  const navItem = (pg: Page): TemplateResult => html`<button
    class=${() => "dnav-link" + (active() === pg.id ? " is-active" : "")}
    type="button"
    aria-current=${() => (active() === pg.id ? "page" : false)}
    @click=${() => go(pg.id)}
  >${() => navLabel(pg)}</button>`;

  const navGroup = (g: { group: string; items: Page[] }): TemplateResult => html`<div class="dnav-group">
    <div class="dnav-grouplabel">${() => (groupLabelKey[g.group] ? t(groupLabelKey[g.group]!) : g.group)}</div>
    ${g.items.map(navItem)}
  </div>`;

  const scrollTo = (id: string): void => {
    (globalThis as { document?: Document }).document?.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return html`
    <header class="dtop">
      <button class="dtop-burger" type="button" aria-label="Menu" @click=${() => navOpen.set(!navOpen())}>☰</button>
      <button class="dtop-brand" type="button" @click=${() => go("overview")}>
        <span class="dtop-dot">dx</span><span class="dtop-name">dxjs</span><span class="dtop-sub">${() => t("shell.tagline")}</span>
      </button>
      <span class="dx-spacer"></span>
      ${langToggle()}
      <button class="dtop-icon" type="button" aria-label="Toggle theme" @click=${() => theme.toggle()}>${() => (theme.theme() === "dark" ? "☀" : "☾")}</button>
      <a class="dtop-icon" href="https://github.com/ngolacloud/dxjs" aria-label="GitHub" target="_blank" rel="noopener">↗</a>
    </header>
    <div class=${() => "dlayout" + (navOpen() ? " is-nav-open" : "")}>
      <div class="dnav-backdrop" @click=${() => navOpen.set(false)}></div>
      <nav class="dside" aria-label="Documentation">${() => grouped().map(navGroup)}</nav>
      <main class="dmain"><div id="doc-content"></div></main>
      <aside class="dtoc">
        <div class="dtoc-inner" ?hidden=${() => toc().length === 0}>
          <h5>${() => t("shell.onThisPage")}</h5>
          ${() => toc().map((h) => html`<button class="dtoc-link" type="button" @click=${() => scrollTo(h.id)}>${h.text}</button>`)}
        </div>
      </aside>
    </div>`;
});

mount(Docs, document.getElementById("app")!, {});
(window as unknown as { __dxready: boolean }).__dxready = true;
