// A tiny, self-contained syntax highlighter for the docs. It tokenizes with
// ordered sticky regexes and emits classed <span>s through dxjs's SAFE text sink
// (so every token is escaped) — no eval, no innerHTML, no external library. That
// is the only way to highlight code under the site's strict CSP. Token classes
// (tok-kw, tok-str, …) are coloured by docs.css in light and dark.
import { html, type TemplateResult } from "@dxjs/dom";

export type Lang = "ts" | "js" | "html" | "bash" | "json" | "text";

interface Rule {
  re: RegExp;
  cls: string;
}
interface Token {
  cls: string;
  text: string;
}

const KW =
  "const|let|var|function|return|if|else|for|while|import|from|export|as|await|async|new|class|extends|implements|typeof|instanceof|in|of|null|true|false|undefined|void|type|interface|enum|public|private|protected|readonly|static|this|super|try|catch|finally|throw|switch|case|default|break|continue|do|yield|delete|satisfies|keyof|infer";

// Each language is a list of rules tried IN ORDER at each position (sticky `y`).
const RULES: Record<Lang, Rule[]> = {
  ts: [
    { re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y, cls: "tok-com" },
    { re: /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/y, cls: "tok-str" },
    { re: new RegExp(`\\b(?:${KW})\\b`, "y"), cls: "tok-kw" },
    { re: /\b\d[\d_]*(?:\.\d+)?\b/y, cls: "tok-num" },
    { re: /@[A-Za-z_$][\w$]*/y, cls: "tok-deco" },
    { re: /[A-Za-z_$][\w$]*(?=\s*\()/y, cls: "tok-fn" },
    { re: /[A-Z][\w$]*/y, cls: "tok-type" },
    { re: /=>|[.,;:(){}\[\]<>?!|&+\-*/%=]+/y, cls: "tok-punct" },
    { re: /[A-Za-z_$][\w$]*/y, cls: "" },
  ],
  js: [], // filled below (= ts)
  html: [
    { re: /<!--[\s\S]*?-->/y, cls: "tok-com" },
    { re: /<\/?[A-Za-z][\w-]*/y, cls: "tok-tag" },
    { re: /"[^"]*"|'[^']*'/y, cls: "tok-str" },
    { re: /[A-Za-z_:@][\w:.-]*(?=\s*=)/y, cls: "tok-attr" },
    { re: /\/?>|[=]/y, cls: "tok-punct" },
  ],
  bash: [
    { re: /#[^\n]*/y, cls: "tok-com" },
    { re: /"[^"]*"|'[^']*'/y, cls: "tok-str" },
    { re: /\b(?:npm|npx|node|cd|git|export|curl|echo|mkdir|sudo)\b/y, cls: "tok-fn" },
    { re: /\$\w+|\$\{[^}]*\}/y, cls: "tok-kw" },
    { re: /(?:^|\s)(--?[A-Za-z][\w-]*)/y, cls: "tok-attr" },
    { re: /\b\d+\b/y, cls: "tok-num" },
  ],
  json: [
    { re: /"[^"]*"(?=\s*:)/y, cls: "tok-attr" },
    { re: /"(?:\\.|[^"\\])*"/y, cls: "tok-str" },
    { re: /-?\b\d[\d.eE+-]*\b/y, cls: "tok-num" },
    { re: /\b(?:true|false|null)\b/y, cls: "tok-kw" },
    { re: /[{}\[\]:,]/y, cls: "tok-punct" },
  ],
  text: [],
};
RULES.js = RULES.ts;

function tokenize(code: string, lang: Lang): Token[] {
  const rules = RULES[lang] ?? [];
  if (rules.length === 0) return [{ cls: "", text: code }];
  const out: Token[] = [];
  let i = 0;
  let plain = "";
  const flushPlain = (): void => {
    if (plain) {
      out.push({ cls: "", text: plain });
      plain = "";
    }
  };
  while (i < code.length) {
    let hit: Token | null = null;
    for (const r of rules) {
      r.re.lastIndex = i;
      const m = r.re.exec(code);
      if (m && m.index === i && m[0].length > 0) {
        // bash flag rule captures a leading space in group 1 — keep only the flag.
        const text = r.cls === "tok-attr" && lang === "bash" && m[1] ? m[1] : m[0];
        if (text !== m[0]) plain += m[0].slice(0, m[0].length - text.length);
        hit = { cls: r.cls, text };
        i += m[0].length;
        break;
      }
    }
    if (hit) {
      flushPlain();
      out.push(hit);
    } else {
      plain += code[i];
      i++;
    }
  }
  flushPlain();
  return out;
}

/** Highlight `code` as `lang` → a template of classed spans (escaped text sinks). */
export function highlight(code: string, lang: Lang): TemplateResult {
  const toks = tokenize(code, lang);
  return html`${toks.map((t) => (t.cls ? html`<span class=${t.cls}>${t.text}</span>` : t.text))}`;
}

/** Infer a language from a file path's extension. */
export function langFromPath(path: string): Lang {
  if (/\.tsx?$/.test(path)) return "ts";
  if (/\.jsx?$/.test(path) || /\.mjs$/.test(path)) return "js";
  if (/\.html?$/.test(path)) return "html";
  if (/\.json$/.test(path) || /package\.json$/.test(path)) return "json";
  if (/\.(sh|bash)$/.test(path)) return "bash";
  return "text";
}
