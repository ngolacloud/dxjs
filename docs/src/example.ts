// The docs are DOGFOODED: this site is a dxjs app. `example()` is the heart of it
// — it shows the authored CODE (as escaped text, never eval'd) beside the LIVE
// result rendered by the very same dxjs primitives. Both halves are written
// together so they stay in sync.
import { html, type TemplateResult } from "@dxjs/dom";
import { card } from "@dxjs/ui";

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

/** A prose paragraph (docs copy). */
export function p(text: string): TemplateResult {
  return html`<p class="doc-p">${text}</p>`;
}

/** A section heading inside a page. */
export function h2(text: string): TemplateResult {
  return html`<h2 class="doc-h2">${text}</h2>`;
}
