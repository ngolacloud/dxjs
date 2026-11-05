// HTML escaping for string contexts (SSR, and the `unsafeHtml` sanitiser seam).
//
// NOTE: the live-DOM renderer does NOT rely on this — it writes data only
// through safe sinks (`textContent`, `setAttribute`), which escape intrinsically.
// `escape` exists for the server string renderer (F2) and for callers that build
// attribute/text fragments by hand.

const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
const HTML_RE = /[&<>"']/g;

/** Escape a value for safe insertion into HTML text or a quoted attribute. */
export function escape(value: unknown): string {
  return String(value).replace(HTML_RE, (c) => HTML_ENTITIES[c] as string);
}
