// The landing / overview page — the bilingual front door that explains what dxjs
// is, why it exists, and how it is layered. All copy flows through i18n `t()`, so
// the whole page flips pt-AO ↔ en live. Live bits (the counter) are rendered by
// the very engine the page describes (dogfooding).
import { signal } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { component } from "@dxjs/component";
import { button, sparkline } from "@dxjs/ui";
import { t } from "./i18n.ts";
import { go } from "./store.ts";

const pillar = (icon: string, titleKey: string, bodyKey: string): TemplateResult => html`
  <div class="lp-pillar">
    <div class="lp-pillar-ico" aria-hidden="true">${icon}</div>
    <h3 class="lp-pillar-title">${() => t(titleKey)}</h3>
    <p class="lp-pillar-body">${() => t(bodyKey)}</p>
  </div>`;

// The layered stack, bottom-up: each package builds on the one below.
const STACK: Array<{ name: string; blurb: string; blurbPt: string }> = [
  { name: "@dxjs/core", blurb: "signals · computed · effect · owner tree", blurbPt: "signals · computed · effect · owner tree" },
  { name: "@dxjs/dom", blurb: "html`` + safe reactive sinks", blurbPt: "html`` + sinks reactivos seguros" },
  { name: "@dxjs/component", blurb: "components · mount · router · context", blurbPt: "componentes · mount · router · contexto" },
  { name: "@dxjs/ui · charts", blurb: "styled kit + Chart.js charts", blurbPt: "kit estilizado + gráficos Chart.js" },
  { name: "@dxjs/transport · query · forms", blurb: "REST/SSE/gRPC · cache · forms", blurbPt: "REST/SSE/gRPC · cache · formulários" },
  { name: "@dxjs/server · edge", blurb: "DOM-free SSR · hydrate · edge handlers", blurbPt: "SSR sem DOM · hidratação · edge" },
];

const flowStep = (n: number, titleKey: string, bodyKey: string): TemplateResult => html`
  <li class="lp-flow-step">
    <span class="lp-flow-n">${String(n)}</span>
    <div><div class="lp-flow-t">${() => t(titleKey)}</div><div class="lp-flow-b">${() => t(bodyKey)}</div></div>
  </li>`;

export const LandingPage = component(() => {
  const n = signal(3);
  const trend = signal<number[]>([3, 5, 2, 8, 6, 9, 7]);
  const bump = (): void => {
    n.update((x) => x + 1);
    trend.update((xs) => [...xs.slice(-11), n()]);
  };
  return html`
    <div class="lp">
      <!-- Hero -->
      <section class="lp-hero">
        <div class="lp-hero-text">
          <span class="lp-kicker">${() => t("landing.kicker")}</span>
          <h1 class="lp-title">${() => t("landing.title")}</h1>
          <p class="lp-sub">${() => t("landing.sub")}</p>
          <div class="lp-cta">
            ${button({ label: () => t("landing.ctaStart"), variant: "primary", size: "md", onClick: () => go("start") })}
            ${button({ label: () => t("landing.ctaGallery"), size: "md", onClick: () => go("gallery") })}
            ${button({ label: () => t("landing.ctaTransport"), size: "md", onClick: () => { window.location.href = "./"; } })}
            ${button({ label: () => t("landing.ctaArch"), variant: "ghost", size: "md", onClick: () => go("overview") })}
          </div>
          <p class="lp-bilingual">${() => t("landing.bilingualNote")}</p>
        </div>
        <div class="lp-hero-demo">
          <div class="lp-demo-card">
            <pre class="lp-demo-code"><code>const n = signal(3);
html\`&lt;button @click=\${bump}&gt;
  n = \${() =&gt; n()}
&lt;/button&gt;\`</code></pre>
            <div class="lp-demo-live">
              ${button({ label: () => `n = ${n()}`, variant: "primary", onClick: bump })}
              ${sparkline({ data: () => trend(), fill: true, dot: true, width: 120, height: 32, ariaLabel: "value trend" })}
            </div>
            <div class="lp-demo-tag">~2.8 KB gzip · 0 eval · CSP strict</div>
          </div>
        </div>
      </section>

      <!-- Pillars -->
      <section class="lp-section">
        <h2 class="lp-section-title">${() => t("landing.pillarsTitle")}</h2>
        <div class="lp-pillars">
          ${pillar("◈", "landing.p1t", "landing.p1b")}
          ${pillar("🛡", "landing.p2t", "landing.p2b")}
          ${pillar("⚡", "landing.p3t", "landing.p3b")}
          ${pillar("☁", "landing.p4t", "landing.p4b")}
        </div>
      </section>

      <!-- Architecture -->
      <section class="lp-section">
        <h2 class="lp-section-title">${() => t("landing.archTitle")}</h2>
        <p class="lp-section-sub">${() => t("landing.archSub")}</p>
        <div class="lp-arch">
          <div class="lp-stack">
            <div class="lp-stack-cap">${() => t("landing.stackTitle")}</div>
            ${STACK.map(
              (layer, i) => html`<div class=${`lp-layer lp-layer-${i}`}>
                <span class="lp-layer-name">${layer.name}</span>
                <span class="lp-layer-blurb">${layer.blurb}</span>
              </div>`,
            )}
          </div>
          <div class="lp-flow">
            <div class="lp-flow-cap">${() => t("landing.flowTitle")}</div>
            <ol class="lp-flow-list">
              ${flowStep(1, "landing.flowStep1", "landing.flowStep1b")}
              ${flowStep(2, "landing.flowStep2", "landing.flowStep2b")}
              ${flowStep(3, "landing.flowStep3", "landing.flowStep3b")}
            </ol>
          </div>
        </div>
      </section>
    </div>`;
});
