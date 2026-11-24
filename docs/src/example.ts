// The docs are DOGFOODED: this site is a dxjs app. `example()` shows authored CODE
// (as escaped text, never eval'd) beside the LIVE result rendered by the same dxjs
// primitives. `runnable()` goes further: it shows the SAME feature as two COMPLETE,
// full-path files — one that runs vanilla in the browser (no build) and one that
// runs in Node — so you can copy either and run it as-is.
import { signal } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { card } from "@dxjs/ui";
import { t } from "./i18n.ts";

export interface ExampleSpec {
  title: string;
  /** Source shown verbatim (rendered as text → CSP-safe, no eval). */
  code: string;
  /** The live result, rendered by real dxjs. Omit for code-only snippets. */
  view?: TemplateResult;
  /** Optional caption under the example. */
  note?: string;
}

/** A titled card: code on the left, the live result on the right. */
export function example(ex: ExampleSpec): TemplateResult {
  return card({
    title: ex.title,
    body: html`
      <div class=${ex.view ? "ex" : "ex ex-solo"}>
        <pre class="ex-code"><code>${ex.code}</code></pre>
        ${ex.view ? html`<div class="ex-view">${ex.view}</div>` : ""}
      </div>
      ${ex.note ? html`<p class="ex-note">${ex.note}</p>` : ""}
    `,
  });
}

export interface RunnableVariant {
  /** Full path of the file, shown as a header (click-to-copy mental model). */
  path: string;
  /** The COMPLETE file contents — copy and run as-is. */
  code: string;
}
export interface RunnableSpec {
  title: string;
  /** The vanilla, no-build browser file. */
  browser: RunnableVariant;
  /** The Node file. */
  node: RunnableVariant;
  /** Optional live result (rendered by real dxjs), shown beside the code. */
  view?: TemplateResult;
  note?: string;
}

/** An example with TWO complete, full-path variants in tabs: Browser (no build)
 *  and Node. The live result (if any) stays beside both. Tab labels are bilingual. */
export function runnable(ex: RunnableSpec): TemplateResult {
  const tab = signal<"browser" | "node">("browser");
  const pane = (which: "browser" | "node", v: RunnableVariant): TemplateResult => html`
    <div class="run-pane" ?hidden=${() => tab() !== which}>
      <div class="run-path"><span class="run-path-ico" aria-hidden="true">📄</span>${v.path}</div>
      <pre class="ex-code run-code"><code>${v.code}</code></pre>
    </div>`;
  const tabBtn = (which: "browser" | "node", key: string): TemplateResult => html`
    <button
      class=${() => "run-tab" + (tab() === which ? " is-active" : "")}
      type="button"
      role="tab"
      aria-selected=${() => (tab() === which ? "true" : "false")}
      @click=${() => tab.set(which)}
    >${() => t(key)}</button>`;
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
        ${ex.view ? html`<div class="ex-view"><div class="ex-view-label">${() => t("ex.result")}</div>${ex.view}</div>` : ""}
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

/** A bilingual page head (title + lead) driven by i18n keys. */
export function headT(titleKey: string, leadKey: string): TemplateResult {
  return html`<h1 class="doc-h1">${() => t(titleKey)}</h1><p class="doc-lead">${() => t(leadKey)}</p>`;
}
