// The component reference of the transport guide (docs/transport.html): every
// @dxjs/ui component from the docs registry (docs/src/components.ts), with its
// lead, a LIVE preview (Desktop/Mobile), and Usage / Populate / Props tabs.
//
// Bundled by docs/build.mjs and inlined into the built page BEFORE the page's own
// script, so the sections exist when that script runs: its highlighter, copy
// buttons, tabs, scrollspy and EN/PT toggle then cover them like any other
// section. pt-AO text is handed over in window.__DX_PROSE (keyed by the English
// text, which is how the page's toggle looks prose up).
import { component, mount } from "@dxjs/component";
import { componentDocs, type ComponentDoc } from "./components.ts";
import { COMPONENT_PT } from "./component-docs.pt.ts";

/** Registry group → [sidebar/heading label EN, PT, eyebrow EN, eyebrow PT]. */
const GROUPS: Record<string, { en: string; pt: string }> = {
  Componentes: { en: "Featured", pt: "Destaques" },
  "UI · Controls": { en: "Controls", pt: "Controlos" },
  "UI · Feedback": { en: "Feedback", pt: "Feedback" },
  "UI · Navigation": { en: "Navigation & layout", pt: "Navegação e layout" },
  "UI · Overlays": { en: "Overlays & menus", pt: "Sobreposições e menus" },
  "UI · Pickers & data": { en: "Pickers & data", pt: "Selectores e dados" },
  "UI · Media & mobile": { en: "Media & mobile", pt: "Multimédia e móvel" },
};
const groupOf = (d: ComponentDoc) => d.group ?? "Componentes";

/** Components whose preview is small: these sit side by side with their code on
 *  a wide column (see .comp.is-compact in docs/transport.html). Big ones —
 *  tables, boards, calendars, shells, wide overlays — keep the full width. */
const COMPACT = new Set([
  "c-button", "c-field", "c-rating", "c-select2", "c-buttongroup", "c-badge", "c-input", "c-textarea",
  "c-select", "c-switch", "c-checkbox", "c-radio", "c-tagsinput", "c-pill", "c-statcard", "c-alert",
  "c-modal", "c-tooltip", "c-skeleton", "c-spinner", "c-progress", "c-meter", "c-topprogress",
  "c-emptystate", "c-segmented", "c-breadcrumb", "c-navpanel", "c-avatar", "c-divider", "c-space",
  "c-dropdown", "c-timeline", "c-popover", "c-popconfirm", "c-contextmenu", "c-datepicker",
  "c-timer", "c-slider", "c-numberinput", "c-timepicker", "c-exportmenu", "c-virtuallist",
  "c-sparkline", "c-metric", "c-image", "c-video", "c-tree", "c-taskpanel", "c-icon",
  "c-bottomsheet", "c-actionsheet", "c-tabbar", "c-fab", "c-swipeactions", "c-pulltorefresh",
  "c-pickerwheel",
]);

const PROSE: Record<string, string> = {
  Components: "Componentes",
  "Components · @dxjs/ui": "Componentes · @dxjs/ui",
  "81 components, live": "81 componentes, ao vivo",
  "Every piece of the @dxjs/ui kit, rendered live by dxjs itself — classes only, CSP-safe, no inline styles. Flip any preview between Desktop and Mobile; the Usage, Populate and Props tabs show how to wire it.":
    "Todas as peças do kit <code>@dxjs/ui</code>, renderizadas ao vivo pelo próprio dxjs — só classes, seguras para CSP, sem estilos inline. Alterna qualquer preview entre Desktop e Telemóvel; os separadores Uso, Popular e Props mostram como o ligar.",
  "Live result": "Resultado ao vivo",
  Mobile: "Telemóvel",
  Usage: "Uso",
  Populate: "Popular",
  Type: "Tipo",
  Description: "Descrição",
};
for (const [key, g] of Object.entries(GROUPS)) {
  void key;
  PROSE[`UI · ${g.en}`] = `UI · ${g.pt}`;
  PROSE[`Component · ${g.en}`] = `Componente · ${g.pt}`;
  PROSE[g.en] = g.pt;
}

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ESC[c]!);
/** Escape, then turn `code` spans into <code>. */
const md = (s: string) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");
/** The page's toggle keys prose by its collapsed textContent — backticks vanish there. */
const key = (s: string) => s.replace(/`/g, "").replace(/\s+/g, " ").trim();

function codeFigure(code: string, fname: string): string {
  return `<figure class="code"><figcaption><span class="fname">${esc(fname)}</span><button class="copy">Copy</button></figcaption><pre><code>${esc(code)}</code></pre></figure>`;
}

function propsTable(d: ComponentDoc): string {
  const rows = (d.props ?? [])
    .map((p) => `<tr><td><code>${esc(p.name)}</code></td><td><code>${esc(p.type)}</code></td><td>${md(p.desc)}</td></tr>`)
    .join("");
  return `<div class="tablewrap"><table><thead><tr><th>Prop</th><th>Type</th><th>Description</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function section(d: ComponentDoc): string {
  const g = GROUPS[groupOf(d)] ?? { en: groupOf(d), pt: groupOf(d) };
  const tabs: [string, string, string][] = [["use", "Usage", codeFigure(d.usageCode, `${d.name}.ts`)]];
  tabs.push([
    "pop",
    "Populate",
    (d.populateNote ? `<p class="comp-note">${md(d.populateNote)}</p>` : "") + codeFigure(d.populateCode, "data.ts"),
  ]);
  if (d.props?.length) tabs.push(["props", "Props", propsTable(d)]);
  const tablist = tabs
    .map(([t, label], i) =>
      `<button role="tab" class="tx" aria-selected="${i === 0}"${i ? ' tabindex="-1"' : ""} id="${d.id}-t-${t}" aria-controls="${d.id}-p-${t}">${label}</button>`)
    .join("");
  const panels = tabs
    .map(([t, , body], i) => `<div role="tabpanel" id="${d.id}-p-${t}" aria-labelledby="${d.id}-t-${t}"${i ? " hidden" : ""}>${body}</div>`)
    .join("");
  return `<section class="doc comp${COMPACT.has(d.id) ? " is-compact" : ""}" id="${d.id}">
  <p class="eyebrow">Component · ${esc(g.en)}</p>
  <h2><code>${esc(d.name)}</code></h2>
  <p class="sub">${md(d.lead)}</p>
  <div class="comp-import"><code>${esc(d.importLine)}</code></div>
  <div class="comp-body">
  <div class="pv">
    <div class="pv-bar"><span class="pv-label">Live result</span>
      <div class="pv-toggle" role="group" aria-label="Preview size">
        <button type="button" class="pv-seg is-active" data-mode="desktop" aria-pressed="true">Desktop</button><button type="button" class="pv-seg" data-mode="mobile" aria-pressed="false">Mobile</button>
      </div>
    </div>
    <div class="pv-stage is-desktop"><div class="pv-device">
      <div class="pv-chrome" aria-hidden="true"><span class="pv-dot"></span><span class="pv-dot"></span><span class="pv-dot"></span><span class="pv-url">localhost · dxjs</span></div>
      <div class="pv-frame" data-demo="${d.id}"><span class="pv-wait">…</span></div>
    </div></div>
  </div>
  <div class="tabs" data-tabs><div class="tablist" role="tablist" aria-label="${esc(d.name)}">${tablist}</div>${panels}</div>
  </div>
</section>`;
}

function build(): void {
  const nav = document.getElementById("dx-comp-nav");
  const host = document.getElementById("dx-components");
  if (!nav || !host) return;

  const order = Object.keys(GROUPS);
  const byGroup = new Map<string, ComponentDoc[]>();
  for (const d of componentDocs) {
    const g = groupOf(d);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(d);
  }
  const groups = [...byGroup.keys()].sort((a, b) => order.indexOf(a) - order.indexOf(b));

  // Sidebar: an overview link, then one group per registry group.
  nav.innerHTML =
    `<div class="side-group"><h4>Components</h4><a href="#components">81 components, live</a></div>` +
    groups
      .map((g) => `<div class="side-group"><h4>UI · ${esc(GROUPS[g]?.en ?? g)}</h4>${byGroup
        .get(g)!
        .map((d) => `<a href="#${d.id}">${esc(d.name)}</a>`)
        .join("")}</div>`)
      .join("");

  // Overview + one section per component.
  const overview = `<section class="doc" id="components">
  <p class="eyebrow">Components · @dxjs/ui</p>
  <h2>81 components, live</h2>
  <p class="sub">Every piece of the <code>@dxjs/ui</code> kit, rendered live by dxjs itself — classes only, CSP-safe, no inline styles. Flip any preview between Desktop and Mobile; the Usage, Populate and Props tabs show how to wire it.</p>
  <div class="cgroups">${groups
    .map((g) => `<div class="cgroup"><h3>${esc(GROUPS[g]?.en ?? g)}</h3><div class="chips">${byGroup
      .get(g)!
      .map((d) => `<a class="chip" href="#${d.id}">${esc(d.name)}</a>`)
      .join("")}</div></div>`)
    .join("")}</div>
</section>`;
  host.innerHTML = overview + componentDocs
    .slice()
    .sort((a, b) => order.indexOf(groupOf(a)) - order.indexOf(groupOf(b)))
    .map(section)
    .join("");

  // pt-AO prose for the page's EN/PT toggle.
  const pt: Record<string, string> = { ...PROSE };
  for (const d of componentDocs) {
    const t = COMPONENT_PT[d.id];
    if (!t) continue;
    pt[key(d.lead)] = md(t.lead);
    if (d.populateNote && t.note) pt[key(d.populateNote)] = md(t.note);
  }
  (window as unknown as { __DX_PROSE?: Record<string, string> }).__DX_PROSE = pt;

  // Desktop / Mobile toggle per preview.
  host.addEventListener("click", (e) => {
    const seg = (e.target as Element).closest<HTMLButtonElement>(".pv-seg");
    if (!seg) return;
    const pv = seg.closest(".pv")!;
    const mode = seg.dataset.mode;
    pv.querySelectorAll<HTMLButtonElement>(".pv-seg").forEach((b) => {
      const on = b === seg;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    const stage = pv.querySelector(".pv-stage")!;
    stage.classList.toggle("is-desktop", mode === "desktop");
    stage.classList.toggle("is-mobile", mode === "mobile");
  });

  // Live demos, mounted as they come near the viewport (81 at once would make the
  // first paint pay for components nobody has scrolled to).
  const docsById = new Map(componentDocs.map((d) => [d.id, d]));
  /** Size a frame to what it shows. Flow content sets the height as usual; an
   *  open overlay (a position:fixed root — modal, drawer, sheet, palette) needs
   *  room the flow doesn't give it, so the frame grows while one is open and
   *  shrinks back when it closes. Menus anchored below a trigger (absolute)
   *  count through their bottom edge. Full-frame layers (backdrops, roots) are
   *  skipped, or a frame could never shrink. */
  const OVERLAY_ROOM = 560;
  const fit = (frame: HTMLElement) => {
    const fb = frame.getBoundingClientRect();
    if (!fb.height) return;
    const all = [...frame.querySelectorAll<HTMLElement>("*")];
    const fixed = all.filter((n) => getComputedStyle(n).position === "fixed");
    let need = 0;
    let bar = 0; // a fixed bar or FAB that stays on screen: room for its own height
    let overlayOpen = false; // a fixed layer covering the frame: an open modal/sheet/palette
    for (const f of fixed) {
      const r = f.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      if (r.height >= fb.height - 2) overlayOpen = true;
      else bar = Math.max(bar, r.height);
    }
    for (const n of all) {
      if (fixed.some((f) => f.contains(n))) continue;
      const r = n.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      const cs = getComputedStyle(n);
      if (cs.visibility === "hidden") continue;
      if (cs.position === "absolute" && r.height >= fb.height - 2) continue;
      need = Math.max(need, r.bottom - fb.top);
    }
    const target = Math.max(96, Math.ceil(need + 22 + bar), overlayOpen ? OVERLAY_ROOM : 0);
    const now = parseFloat(frame.style.minHeight) || 0;
    if (Math.abs(target - now) > 2) frame.style.minHeight = `${target}px`;
  };
  const watchFit = (frame: HTMLElement) => {
    let queued = false;
    const schedule = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        fit(frame);
      });
    };
    new MutationObserver(schedule).observe(frame, { subtree: true, childList: true, attributes: true, characterData: true });
    frame.addEventListener("transitionend", schedule);
    schedule();
  };

  const mountDemo = (frame: HTMLElement) => {
    if (frame.dataset.mounted) return;
    frame.dataset.mounted = "1";
    const d = docsById.get(frame.dataset.demo ?? "");
    if (!d) return;
    frame.textContent = "";
    try {
      mount(component(() => d.demo()), frame, {});
      watchFit(frame);
    } catch (err) {
      frame.textContent = `preview failed: ${String(err)}`;
      frame.classList.add("pv-error");
    }
  };
  const frames = host.querySelectorAll<HTMLElement>(".pv-frame[data-demo]");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) {
          io.unobserve(en.target);
          mountDemo(en.target as HTMLElement);
        }
      }),
      { rootMargin: "600px 0px" },
    );
    frames.forEach((f) => io.observe(f));
  } else {
    frames.forEach(mountDemo);
  }
}

build();
