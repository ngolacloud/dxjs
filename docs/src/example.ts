// The docs are DOGFOODED: this site is a dxjs app. `example()` shows authored CODE
// (highlighted, escaped, never eval'd) beside the LIVE result rendered by the same
// dxjs primitives. `runnable()` shows the SAME feature two ways — a CDN, no-build
// browser file and a Node file (install + run). Code blocks get react.dev-style
// chrome: a filename header, a copy button, and CSP-safe syntax highlighting. Live
// results carry a Desktop/Mobile preview toggle.
import { signal } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { card } from "@dxjs/ui";
import { t } from "./i18n.ts";
import { highlight, langFromPath, type Lang } from "./highlight.ts";

export interface CodeBlockSpec {
  code: string;
  lang?: Lang;
  /** Shown as a filename tab in the header; also sets the language if `lang` is absent. */
  filename?: string;
  /** Show the copy button (default true). */
  copy?: boolean;
}

/** A react.dev-style code block: header (filename/lang + copy) + highlighted body. */
export function codeBlock(spec: CodeBlockSpec): TemplateResult {
  const lang: Lang = spec.lang ?? (spec.filename ? langFromPath(spec.filename) : "ts");
  const copied = signal(false);
  const doCopy = (): void => {
    const nav = (globalThis as { navigator?: Navigator }).navigator;
    void nav?.clipboard?.writeText(spec.code);
    copied.set(true);
    setTimeout(() => copied.set(false), 1200);
  };
  return html`<div class="cb">
    <div class="cb-head">
      <span class="cb-name">${spec.filename ?? lang.toUpperCase()}</span>
      ${spec.copy === false
        ? ""
        : html`<button class="cb-copy" type="button" @click=${doCopy} aria-label=${() => (copied() ? t("ex.copied") : t("ex.copy"))}>
            <span class="cb-copy-ico" aria-hidden="true">${() => (copied() ? "✓" : "⧉")}</span>${() => (copied() ? t("ex.copied") : t("ex.copy"))}
          </button>`}
    </div>
    <pre class="cb-pre"><code>${highlight(spec.code, lang)}</code></pre>
  </div>`;
}

/** A Desktop/Mobile toggle wrapping a live preview. In mobile mode the preview is
 *  constrained to a phone-width frame. */
export function preview(view: TemplateResult): TemplateResult {
  const mode = signal<"desktop" | "mobile">("desktop");
  const seg = (m: "desktop" | "mobile", label: string, icon: string): TemplateResult => html`<button
    class=${() => "pv-seg" + (mode() === m ? " is-active" : "")}
    type="button"
    aria-pressed=${() => (mode() === m ? "true" : "false")}
    @click=${() => mode.set(m)}
  ><span aria-hidden="true">${icon}</span>${label}</button>`;
  return html`<div class="pv">
    <div class="pv-bar">
      <span class="pv-label">${() => t("ex.result")}</span>
      <span class="dx-spacer"></span>
      <div class="pv-toggle" role="group" aria-label="Preview size">
        ${seg("desktop", () => t("ex.desktop"), "🖥")}${seg("mobile", () => t("ex.mobile"), "📱")}
      </div>
    </div>
    <div class=${() => "pv-stage is-" + mode()}>
      <div class="pv-frame">${view}</div>
    </div>
  </div>`;
}

export interface ExampleSpec {
  title: string;
  /** Source shown verbatim (highlighted, escaped → CSP-safe, no eval). */
  code: string;
  lang?: Lang;
  filename?: string;
  /** The live result, rendered by real dxjs. Omit for code-only snippets. */
  view?: TemplateResult;
  /** Optional caption under the example. */
  note?: string;
}

/** A titled card: highlighted code on the left, the live result (with a device
 *  toggle) on the right. */
export function example(ex: ExampleSpec): TemplateResult {
  return card({
    title: ex.title,
    body: html`
      <div class=${ex.view ? "ex" : "ex ex-solo"}>
        ${codeBlock({ code: ex.code, lang: ex.lang, filename: ex.filename })}
        ${ex.view ? html`<div class="ex-view">${preview(ex.view)}</div>` : ""}
      </div>
      ${ex.note ? html`<p class="ex-note">${ex.note}</p>` : ""}
    `,
  });
}

export interface RunnableVariant {
  /** Full path of the file, shown as the code header. */
  path: string;
  /** The COMPLETE file contents — copy and run as-is. */
  code: string;
  lang?: Lang;
}
export interface RunnableSpec {
  title: string;
  /** The CDN, no-build browser file (loads dxjs from esm.sh). */
  browser: RunnableVariant;
  /** The Node file (npm install + import + run). */
  node: RunnableVariant;
  /** Optional live result (rendered by real dxjs). */
  view?: TemplateResult;
  note?: string;
}

/** An example with TWO complete, full-path variants in tabs: Browser (CDN, no
 *  build) and Node (install + run). Each tab is a full codeBlock; the live result
 *  (if any) stays beside both with a device toggle. */
export function runnable(ex: RunnableSpec): TemplateResult {
  const tab = signal<"browser" | "node">("browser");
  const tabBtn = (which: "browser" | "node", key: string): TemplateResult => html`
    <button
      class=${() => "run-tab" + (tab() === which ? " is-active" : "")}
      type="button"
      role="tab"
      aria-selected=${() => (tab() === which ? "true" : "false")}
      @click=${() => tab.set(which)}
    >${() => t(key)}</button>`;
  const pane = (which: "browser" | "node", v: RunnableVariant): TemplateResult => html`
    <div class="run-pane" ?hidden=${() => tab() !== which}>
      ${codeBlock({ code: v.code, lang: v.lang, filename: v.path })}
    </div>`;
  return card({
    title: ex.title,
    body: html`
      <div class=${ex.view ? "ex run" : "ex run ex-solo"}>
        <div class="run-codes">
          <div class="run-tabs" role="tablist">
            ${tabBtn("browser", "ex.browser")}${tabBtn("node", "ex.node")}
          </div>
          ${pane("browser", ex.browser)}
          ${pane("node", ex.node)}
        </div>
        ${ex.view ? html`<div class="ex-view">${preview(ex.view)}</div>` : ""}
      </div>
      ${ex.note ? html`<p class="ex-note">${ex.note}</p>` : ""}
    `,
  });
}

/** A prose paragraph (docs copy). */
export function p(text: string): TemplateResult {
  return html`<p class="doc-p">${text}</p>`;
}

/** A reactive prose paragraph driven by an i18n key. */
export function pt(key: string): TemplateResult {
  return html`<p class="doc-p">${() => t(key)}</p>`;
}

/** A section heading inside a page. */
export function h2(text: string): TemplateResult {
  return html`<h2 class="doc-h2">${text}</h2>`;
}

/** A react.dev-style callout box. tone: note | pitfall | deep. */
export function callout(tone: "note" | "pitfall" | "deep", title: string, body: string): TemplateResult {
  const icon = tone === "pitfall" ? "⚠" : tone === "deep" ? "🧭" : "ℹ";
  return html`<div class=${`doc-callout is-${tone}`}>
    <div class="doc-callout-head"><span class="doc-callout-ico" aria-hidden="true">${icon}</span>${title}</div>
    <p class="doc-callout-body">${body}</p>
  </div>`;
}

/** A bilingual page head (title + lead) driven by i18n keys. */
export function headT(titleKey: string, leadKey: string): TemplateResult {
  return html`<h1 class="doc-h1">${() => t(titleKey)}</h1><p class="doc-lead">${() => t(leadKey)}</p>`;
}
