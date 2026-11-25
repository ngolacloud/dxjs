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

// --- URL-scheme sanitising (navigation attributes) ------------------------
// A data-controlled value in a URL-bearing attribute can smuggle an executable
// scheme (`javascript:`/`vbscript:`, or `data:text/html` in a navigational
// context). `escape` does NOT help — it has no metacharacters to act on in such a
// value. Both the live renderer and the SSR string renderer route URL attributes
// through `sanitizeUrl`. Media `data:` URLs (image/audio/video/font) stay allowed
// so the common `<img src=data:image/…>` keeps working under `img-src 'self' data:`.
const URL_ATTRS = new Set([
  "href", "src", "action", "formaction", "xlink:href", "poster",
  "data", "ping", "background", "cite", "longdesc", "usemap",
]);
const DANGEROUS_SCHEME = /^(?:javascript|vbscript):/i;
const SAFE_DATA = /^data:(?:image|audio|video|font)\//i;
// Control/whitespace chars (U+0000–U+0020) browsers ignore but that can hide the
// scheme from a naive check (e.g. "java\tscript:" or a leading newline).
const HIDDEN_CHARS = /[\u0000-\u0020]+/g;

/** Is `name` a URL-bearing attribute whose value must be scheme-checked? */
export function isUrlAttr(name: string): boolean {
  return URL_ATTRS.has(name.toLowerCase());
}

// DOM properties that parse their string as raw HTML — a `.prop` bind to any of
// these is an XSS sink (and, on hydration, diverges from the escaped SSR output).
// The engine refuses them; use a dedicated unsafe-HTML seam for the rare real need.
const UNSAFE_PROPS = new Set(["innerhtml", "outerhtml", "srcdoc"]);

/** Is `prop` a DOM property that would write data as raw HTML? */
export function isUnsafeProp(prop: string): boolean {
  return UNSAFE_PROPS.has(prop.toLowerCase());
}

/** Neutralise a dangerous URL scheme in a navigation-attribute value. Returns the
 *  value unchanged when safe, or "" when it carries an executable scheme. */
export function sanitizeUrl(value: string): string {
  const probe = value.replace(HIDDEN_CHARS, "").toLowerCase();
  if (DANGEROUS_SCHEME.test(probe)) return "";
  if (probe.startsWith("data:") && !SAFE_DATA.test(value.trim())) return "";
  return value;
}
