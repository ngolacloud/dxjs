// Bilingual layer for the docs site (pt-AO / en). Built on @dxjs/i18n: `t()` reads
// the reactive locale signal, so any binding `${() => t("key")}` re-derives when
// the language switches — no reload, no eval. Angolan Portuguese is the default
// (the console's home audience), English is one click away.
import { createI18n } from "@dxjs/i18n";
import { html, type TemplateResult } from "@dxjs/dom";

export type Locale = "pt-AO" | "en";

const messages = {
  "pt-AO": {
    shell: {
      tagline: "Motor de UI reactivo · seguro por omissão",
      language: "Idioma",
      theme: "Tema",
      light: "Claro",
      dark: "Escuro",
    },
    nav: {
      groupStart: "Início",
      groupGuide: "Guia",
      groupPackages: "Pacotes",
      groupLearn: "Aprender",
      overview: "Visão geral",
      gallery: "Componentes",
      start: "Começar",
    },
    ex: {
      browser: "Browser (sem build)",
      node: "Node",
      result: "Resultado ao vivo",
      file: "ficheiro",
    },
    landing: {
      kicker: "NgolaCloud · consola",
      title: "UI reactiva, minúscula e à prova de CSP.",
      sub: "O dxjs renderiza com signals de grão fino — sem Virtual DOM, sem ciclo de re-render, sem build em desenvolvimento. Uma app reactiva completa pesa ~2,8 KB gzip e corre sob uma Content-Security-Policy estrita: sem eval, sem handlers inline, dados escapados por omissão.",
      ctaStart: "Começar",
      ctaGallery: "Ver componentes",
      ctaArch: "Arquitectura",
      pillarsTitle: "Porquê o dxjs",
      p1t: "Grão fino, não Virtual DOM",
      p1b: "O componente corre uma vez e liga cada ponto dinâmico a um signal. Ao mudar, só esse binding reage — uma actualização cirúrgica, nunca um diff de árvore.",
      p2t: "Seguro por construção",
      p2b: "Nada de eval nem de innerHTML de dados. Os valores passam por sinks seguros (textContent, setAttribute, .prop, @event) e são escapados — XSS fechado à nascença, sob CSP estrita.",
      p3t: "Minúsculo e sem build",
      p3b: "Núcleo ~1,5 KB, app completa ~2,8 KB gzip (vs ~45 KB React+ReactDOM). Corre vanilla no browser e em Node com TypeScript nativo — sem transpilar.",
      p4t: "Pronto para a nuvem",
      p4b: "SSR sem DOM que faz streaming, hidratação de grão fino, transporte REST/SSE/gRPC e handlers de edge — a mesma fonte do portátil ao edge.",
      archTitle: "Arquitectura em camadas",
      archSub: "Cada pacote assenta no anterior. Importa só o que usas — tudo é tree-shakeable (sideEffects:false).",
      stackTitle: "A pilha, de baixo para cima",
      flowTitle: "Como corre um ecrã",
      flowStep1: "Sinal muda",
      flowStep1b: "signal.set() marca os leitores como sujos",
      flowStep2: "Binding reage",
      flowStep2b: "só os effects/computeds que leram esse signal re-correm",
      flowStep3: "DOM cirúrgico",
      flowStep3b: "um nó de texto, um atributo, uma linha — nunca um diff",
      bilingualNote: "Este site está em português de Angola e inglês — usa o selector no topo.",
    },
    gallery: {
      title: "Componentes",
      lead: "O kit @dxjs/ui — compacto, elegante e seguro sob CSP. Só alterna classes; o visual vive no ui.css servido na mesma origem. Todos os controlos têm a escala de tamanhos xs·sm·md·lg·xl·xxl (≡ 1–6).",
      controls: "Controlos base",
      feedback: "Feedback",
      navs: "Navegação",
      pickers: "Entradas ricas",
      data: "Dados",
      metrics: "Métricas",
      calendar: "Calendário (UTC + feriados de Angola)",
      schedule: "Gantt & planeador",
      media: "Média",
      geo: "Mapa",
      rating: "Classificação",
      search: "Pesquisa & filtro (Ctrl+K, estilo Odoo)",
      tables: "Tabelas com export (CSV · XLS · XLSX)",
      sizes: "Escala de tamanhos (xs → xxl ≡ 1 → 6)",
    },
  },
  en: {
    shell: {
      tagline: "Fine-grained reactive UI · secure by default",
      language: "Language",
      theme: "Theme",
      light: "Light",
      dark: "Dark",
    },
    nav: {
      groupStart: "Start",
      groupGuide: "Guide",
      groupPackages: "Packages",
      groupLearn: "Learn",
      overview: "Overview",
      gallery: "Components",
      start: "Getting started",
    },
    ex: {
      browser: "Browser (no build)",
      node: "Node",
      result: "Live result",
      file: "file",
    },
    landing: {
      kicker: "NgolaCloud · console",
      title: "Reactive UI, tiny and CSP-proof.",
      sub: "dxjs renders with fine-grained signals — no Virtual DOM, no re-render cycle, no build step in development. A full reactive app is ~2.8 KB gzip and runs under a strict Content-Security-Policy: no eval, no inline handlers, data escaped by default.",
      ctaStart: "Get started",
      ctaGallery: "See components",
      ctaArch: "Architecture",
      pillarsTitle: "Why dxjs",
      p1t: "Fine-grained, not Virtual DOM",
      p1b: "A component runs once and wires each dynamic spot to a signal. On change only that binding reacts — a surgical update, never a tree diff.",
      p2t: "Secure by construction",
      p2b: "No eval, no innerHTML of data. Values go through safe sinks (textContent, setAttribute, .prop, @event) and are escaped — XSS closed at birth, under a strict CSP.",
      p3t: "Tiny and build-free",
      p3b: "Core ~1.5 KB, full app ~2.8 KB gzip (vs ~45 KB React+ReactDOM). Runs vanilla in the browser and in Node with native TypeScript — no transpile.",
      p4t: "Cloud-native ready",
      p4b: "DOM-free streaming SSR, fine-grained hydration, REST/SSE/gRPC transport and edge handlers — one source from laptop to edge.",
      archTitle: "Layered architecture",
      archSub: "Each package builds on the one below. Import only what you use — everything is tree-shakeable (sideEffects:false).",
      stackTitle: "The stack, bottom-up",
      flowTitle: "How a screen runs",
      flowStep1: "A signal changes",
      flowStep1b: "signal.set() marks readers dirty",
      flowStep2: "Bindings react",
      flowStep2b: "only the effects/computeds that read that signal re-run",
      flowStep3: "Surgical DOM",
      flowStep3b: "one text node, one attribute, one row — never a diff",
      bilingualNote: "This site is in Angolan Portuguese and English — use the switch at the top.",
    },
    gallery: {
      title: "Components",
      lead: "The @dxjs/ui kit — compact, elegant and CSP-safe. It only toggles classes; the look lives in the same-origin ui.css. Every control carries the xs·sm·md·lg·xl·xxl size scale (≡ 1–6).",
      controls: "Base controls",
      feedback: "Feedback",
      navs: "Navigation",
      pickers: "Rich inputs",
      data: "Data",
      metrics: "Metrics",
      calendar: "Calendar (UTC + Angola holidays)",
      schedule: "Gantt & planner",
      media: "Media",
      geo: "Map",
      rating: "Rating",
      search: "Search & filter (Ctrl+K, Odoo-style)",
      tables: "Tables with export (CSV · XLS · XLSX)",
      sizes: "Size scale (xs → xxl ≡ 1 → 6)",
    },
  },
};

export const i18n = createI18n({ locale: "pt-AO", fallbackLocale: "en", messages });

/** Reactive translate. Use as `${() => t("landing.title")}` so it re-derives on switch. */
export const t = (key: string, params?: Record<string, string | number>): string => i18n.t(key, params);
export const locale = i18n.locale;
export const setLocale = (l: Locale): void => i18n.setLocale(l);

/** A two-button language switch (EN · PT), reactive. */
export function langToggle(): TemplateResult {
  const btn = (l: Locale, label: string): TemplateResult =>
    html`<button
      class=${() => "dx-seg-item" + (locale() === l ? " is-active" : "")}
      type="button"
      aria-pressed=${() => (locale() === l ? "true" : "false")}
      @click=${() => setLocale(l)}
    >${label}</button>`;
  return html`<div class="dx-seg" role="group" aria-label="Language">${btn("pt-AO", "PT")}${btn("en", "EN")}</div>`;
}
