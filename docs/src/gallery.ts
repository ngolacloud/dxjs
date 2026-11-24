// The component gallery — the @dxjs/ui v2 kit shown live, grouped by category,
// with bilingual section headers. Every tile is the REAL component (dogfooding),
// so what you see is exactly what you ship.
import { signal } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { component } from "@dxjs/component";
import {
  button, buttonGroup, badge, pill, input, field, select, switchToggle, checkbox, radioGroup, textarea,
  alert, modal, tooltip, skeleton, spinner, progress, meter, emptyState,
  tabs, segmented, breadcrumb, navPanel, avatar, divider,
  searchableSelect, datePicker, timer, sparkline,
  metric, metricGrid, calendar, gantt, planner, image, carousel, worldMap, starRating, searchFilter, tableList,
  type Size,
} from "@dxjs/ui";
import { t } from "./i18n.ts";

// A tiny inline SVG as a data: URI — same-origin-free, CSP img-src 'self' data:.
const DEMO_IMG =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns='http://www.w3.org/2000/svg' width='320' height='180'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#2563eb'/><stop offset='1' stop-color='#7c3aed'/></linearGradient></defs><rect width='320' height='180' fill='url(#g)'/><text x='160' y='98' font-family='sans-serif' font-size='22' fill='white' text-anchor='middle'>dxjs</text></svg>`,
  );

const tile = (label: string, body: TemplateResult): TemplateResult => html`
  <div class="gl-tile">
    <div class="gl-tile-label">${label}</div>
    <div class="gl-tile-body">${body}</div>
  </div>`;

const section = (titleKey: string, tiles: TemplateResult[]): TemplateResult => html`
  <section class="gl-section">
    <h2 class="gl-section-title">${() => t(titleKey)}</h2>
    <div class="gl-grid">${tiles}</div>
  </section>`;

export const GalleryPage = component(() => {
  // Live, interacting state for the demos.
  const on = signal(true);
  const agree = signal(false);
  const plan = signal("team");
  const prog = signal(62);
  const tab = signal("overview");
  const seg = signal("week");
  const tags = signal<string[]>(["b"]);
  const date = signal("2026-11-24");
  const modalOpen = signal(false);
  const calSel = signal("2026-11-11");
  const stars = signal(3);

  const sizes: Size[] = ["xs", "sm", "md", "lg", "xl", "xxl"];
  interface TRow { id: string; company: string; plan: string; mrr: number; }
  const tRows: TRow[] = [
    { id: "1", company: "Acme", plan: "Team", mrr: 490 },
    { id: "2", company: "Globex", plan: "Solo", mrr: 120 },
    { id: "3", company: "Initech", plan: "Org", mrr: 1450 },
  ];

  return html`
    <h1 class="doc-h1">${() => t("gallery.title")}</h1>
    <p class="doc-lead">${() => t("gallery.lead")}</p>

    ${section("gallery.sizes", [
      tile("button size xs→xxl", html`<div class="gl-row">${sizes.map((s) => button({ label: s, size: s }))}</div>`),
      tile("input size (1→6)", html`<div class="gl-stack">${([1, 3, 6] as Size[]).map((s) => input({ placeholder: `size ${s}`, size: s }))}</div>`),
    ])}

    ${section("gallery.controls", [
      tile("button", html`<div class="gl-row">${button({ label: "Primary", variant: "primary" })}${button({ label: "Default" })}${button({ label: "Ghost", variant: "ghost" })}${button({ label: "Danger", variant: "danger" })}</div>`),
      tile("buttonGroup", buttonGroup([button({ label: "Day" }), button({ label: "Week", variant: "primary" }), button({ label: "Month" })])),
      tile("badge · pill", html`<div class="gl-row">${badge("new", "info")}${badge("beta", "warn")}${pill("Active", "pos")}${pill("Churned", "neg")}</div>`),
      tile("input · field", field({ label: "Email", placeholder: "you@ngola.ao", hint: "we never share it" })),
      tile("select", select({ options: [{ value: "solo", label: "Solo" }, { value: "team", label: "Team" }, { value: "org", label: "Org" }], value: () => plan(), onChange: (v) => plan.set(v) })),
      tile("textarea", textarea({ placeholder: "Notes…", rows: 2 })),
      tile("switch", switchToggle({ checked: () => on(), onChange: (c) => on.set(c), label: "Notifications" })),
      tile("checkbox", checkbox({ checked: () => agree(), onChange: (c) => agree.set(c), label: "I agree" })),
      tile("radioGroup", radioGroup({ options: [{ value: "a", label: "Monthly" }, { value: "b", label: "Yearly" }], value: () => "b" })),
    ])}

    ${section("gallery.feedback", [
      tile("alert", alert({ tone: "pos", title: "Deployed", body: "Build 418 is live." })),
      tile("alert · warn", alert({ tone: "warn", body: "Token expires in 3 days.", icon: "⚠" })),
      tile("progress", progress({ value: () => prog(), showValue: true })),
      tile("meter", html`<div class="gl-stack">${meter({ value: () => 0.34, tone: "pos", label: "cpu" })}${meter({ value: () => 0.78, tone: "warn", label: "mem" })}</div>`),
      tile("spinner · tooltip", html`<div class="gl-row">${spinner("loading")}${tooltip({ tip: "Rebuild the index", children: button({ label: "Hover me" }) })}</div>`),
      tile("skeleton", skeleton({ kind: "line", lines: 3 })),
      tile("modal", html`<div>${button({ label: "Open modal", onClick: () => modalOpen.set(true) })}${modal({ open: () => modalOpen(), title: "Confirm", body: "Delete this stack? This cannot be undone.", footer: html`<div class="gl-row">${button({ label: "Cancel", onClick: () => modalOpen.set(false) })}${button({ label: "Delete", variant: "danger", onClick: () => modalOpen.set(false) })}</div>`, onClose: () => modalOpen.set(false) })}</div>`),
      tile("emptyState", emptyState({ icon: "📭", title: "No deployments", description: "Push to main to see builds here." })),
    ])}

    ${section("gallery.navs", [
      tile("tabs", tabs({ tabs: [{ id: "overview", label: "Overview" }, { id: "logs", label: "Logs", count: 12 }, { id: "settings", label: "Settings" }], active: () => tab(), onSelect: (id) => tab.set(id) })),
      tile("segmented", segmented({ options: [{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }], value: () => seg(), onChange: (v) => seg.set(v) })),
      tile("breadcrumb", breadcrumb([{ label: "Projects", onClick: () => {} }, { label: "ngola-api", onClick: () => {} }, { label: "Deploy" }])),
      tile("avatar", html`<div class="gl-row">${avatar({ initials: "WT", name: "Walter", size: "sm" })}${avatar({ initials: "AN", name: "Ana" })}${avatar({ initials: "DX", name: "dxjs", size: "lg" })}</div>`),
      tile("navPanel", navPanel({ active: () => "deploys", onSelect: () => {}, groups: [{ label: "Workspace", items: [{ id: "overview", label: "Overview", icon: "◧" }, { id: "deploys", label: "Deploys", icon: "▲", badge: 3 }, { id: "logs", label: "Logs", icon: "≋" }] }] })),
      tile("divider", html`<div>${divider("or")}</div>`),
    ])}

    ${section("gallery.pickers", [
      tile("searchableSelect (multi)", searchableSelect({ multiple: true, placeholder: "Pick fruit…", value: () => tags(), onChange: (v) => tags.set(v as string[]), options: [{ value: "a", label: "Apple" }, { value: "b", label: "Banana" }, { value: "c", label: "Cherry" }, { value: "d", label: "Date" }] })),
      tile("datePicker", datePicker({ value: () => date(), onChange: (d) => date.set(d) })),
      tile("timer (countdown)", timer({ mode: "countdown", seconds: 90 })),
    ])}

    ${section("gallery.data", [
      tile("sparkline", html`<div class="gl-row">${sparkline({ data: [4, 8, 5, 9, 7, 11, 9, 13], fill: true, dot: true })}${sparkline({ data: [12, 9, 11, 7, 8, 5, 6, 3], tone: "neg", fill: true })}</div>`),
    ])}

    ${section("gallery.metrics", [
      metricGrid([
        { label: "MRR", value: "$62,350", delta: "+12.4%", tone: "pos", trend: [40, 44, 42, 50, 55, 62], icon: "$" },
        { label: "Active users", value: "3,920", delta: "+5.1%", tone: "pos", trend: [30, 32, 31, 36, 38, 39] },
        { label: "Churn", value: "2.1%", delta: "-0.3%", tone: "neg", trend: [4, 3.5, 3, 2.8, 2.4, 2.1] },
      ]),
    ])}

    ${section("gallery.calendar", [
      calendar({
        value: () => calSel(),
        onSelect: (d) => calSel.set(d),
        locale: "pt-AO",
        holidays: true,
        events: [
          { date: "2026-11-20", title: "Deploy", tone: "info" },
          { date: "2026-11-25", title: "Review", tone: "warn" },
        ],
      }),
    ])}

    ${section("gallery.schedule", [
      tile("gantt", gantt({
        tasks: [
          { id: "d", label: "Design", start: "2026-11-02", end: "2026-11-08", tone: "info", progress: 100 },
          { id: "b", label: "Build", start: "2026-11-06", end: "2026-11-20", tone: "pos", progress: 60 },
          { id: "s", label: "Ship", start: "2026-11-20", end: "2026-11-27", tone: "warn", progress: 10 },
        ],
      })),
      tile("planner (weekly)", planner({
        dayLabels: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
        events: [
          { id: "a", day: 1, start: "09:00", end: "10:30", title: "Standup", tone: "info" },
          { id: "b", day: 3, start: "14:00", end: "16:00", title: "Deploy", tone: "pos" },
        ],
      })),
    ])}

    ${section("gallery.media", [
      tile("image (16/9)", image({ src: DEMO_IMG, alt: "dxjs placeholder", ratio: "16/9", rounded: true })),
      tile("carousel", carousel({
        slides: [
          html`<div class="gl-slide">Slide 1 — reactive</div>`,
          html`<div class="gl-slide">Slide 2 — CSP-safe</div>`,
          html`<div class="gl-slide">Slide 3 — tiny</div>`,
        ],
      })),
    ])}

    ${section("gallery.geo", [
      worldMap({
        markers: [
          { lon: 13.23, lat: -8.84, label: "Luanda", tone: "pos" },
          { lon: -9.14, lat: 38.72, label: "Lisboa", tone: "info" },
          { lon: -46.63, lat: -23.55, label: "São Paulo", tone: "warn" },
          { lon: 2.35, lat: 48.86, label: "Paris" },
        ],
      }),
    ])}

    ${section("gallery.rating", [
      tile("starRating (interactive)", starRating({ value: () => stars(), onChange: (v) => stars.set(v), size: "lg" })),
      tile("starRating (read-only)", starRating({ value: 4, max: 5 })),
    ])}

    ${section("gallery.search", [
      searchFilter({
        fields: [{ key: "name", label: "Name" }, { key: "city", label: "City" }],
        filters: [{ id: "active", label: "Active" }, { id: "trial", label: "Trial" }],
        groupBy: [{ id: "plan", label: "Plan" }, { id: "city", label: "City" }],
        placeholder: "Search… (press Ctrl/⌘ + K)",
      }),
    ])}

    ${section("gallery.tables", [
      tableList<TRow>({
        title: "Companies",
        columns: [
          { key: "company", label: "Company" },
          { key: "plan", label: "Plan" },
          { key: "mrr", label: "MRR", numeric: true, value: (r) => r.mrr, render: (r) => `$${r.mrr}` },
        ],
        rows: tRows,
        rowKey: (r) => r.id,
        exportable: true,
      }),
    ])}
  `;
});
