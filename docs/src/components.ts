// One page per component — the delonix docs pattern. Each page has a "Usar" (usage
// code + a live demo you can flip Desktop/Mobile) and a "Popular" section (the data
// shape + how to feed it), plus a props table. Driven by a registry so coverage is
// broad and consistent. Live demos are created inside the page component (so signals
// /onMount work), shown through the device preview.
import { signal } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { component, type Component } from "@dxjs/component";
import {
  button, badge, pill, input, field, select, switchToggle, checkbox, radioGroup,
  alert, modal, tooltip, progress, meter, tabs, segmented, avatar,
  dataTable, tableList, calendar, metric, metricGrid, gantt, planner, carousel, image,
  worldMap, starRating, searchFilter, searchableSelect, datePicker, sparkline,
} from "@dxjs/ui";
import { codeBlock, preview } from "./example.ts";
import { t } from "./i18n.ts";
import type { Page } from "./pages.ts";

export interface PropRow { name: string; type: string; desc: string; }
export interface ComponentDoc {
  id: string;
  name: string;
  pkg: string;
  lead: string;
  group?: string;
  importLine: string;
  usageCode: string;
  /** Built inside the page component (fresh signals per mount). */
  demo: () => TemplateResult;
  populateCode: string;
  populateNote?: string;
  props?: PropRow[];
}

const propsTable = (rows: PropRow[]): TemplateResult => html`<table class="cd-props">
  <thead><tr><th>Prop</th><th>Tipo</th><th>Descrição</th></tr></thead>
  <tbody>${rows.map(
    (r) => html`<tr><td class="cd-name">${r.name}</td><td class="cd-type">${r.type}</td><td>${r.desc}</td></tr>`,
  )}</tbody>
</table>`;

/** Turn a ComponentDoc into a documentation Page. */
export function makeComponentPage(doc: ComponentDoc): Page {
  const view: Component = component(() => html`
    <h1 class="doc-h1">${doc.name}</h1>
    <p class="doc-lead">${doc.lead}</p>
    <div class="cd-meta"><span class="doc-tag ok">${doc.pkg}</span></div>
    <div class="cd-import">${html`<b>import</b> { ${doc.name} } <b>from</b> "${doc.pkg}";`}</div>

    <h2 class="doc-h2">${() => t("cd.use")}</h2>
    <div class="ex">
      ${codeBlock({ code: doc.usageCode, filename: `${doc.name}.ts` })}
      <div class="ex-view">${preview(doc.demo())}</div>
    </div>

    <h2 class="doc-h2">${() => t("cd.populate")}</h2>
    ${doc.populateNote ? html`<p class="doc-p">${doc.populateNote}</p>` : ""}
    ${codeBlock({ code: doc.populateCode, filename: "data.ts" })}

    ${doc.props && doc.props.length ? html`<h2 class="doc-h2">${() => t("cd.props")}</h2>${propsTable(doc.props)}` : ""}
  `);
  return { id: doc.id, label: doc.name, group: doc.group ?? "Componentes", view };
}

// --- The registry ----------------------------------------------------------
const COMPANIES = [
  { id: "1", company: "Acme", plan: "Team", mrr: 490, status: "Active" },
  { id: "2", company: "Globex", plan: "Solo", mrr: 120, status: "Trial" },
  { id: "3", company: "Initech", plan: "Org", mrr: 1450, status: "Active" },
  { id: "4", company: "Umbrella", plan: "Team", mrr: 380, status: "Churned" },
  { id: "5", company: "Stark", plan: "Org", mrr: 2100, status: "Active" },
];
type Company = (typeof COMPANIES)[number];

export const componentDocs: ComponentDoc[] = [
  // ---- dataTable (rich) ----
  {
    id: "c-datatable",
    name: "dataTable",
    pkg: "@dxjs/ui",
    lead: "A sortable, searchable, paginated table with selection, row actions, export (CSV/XLS/XLSX), sticky header, density and loading state.",
    importLine: 'import { dataTable } from "@dxjs/ui";',
    usageCode: `dataTable<Company>({
  title: "Companies",
  columns: [
    { key: "company", label: "Company", sortable: true },
    { key: "plan", label: "Plan" },
    { key: "mrr", label: "MRR", numeric: true, sortable: true,
      value: r => r.mrr, render: r => "$" + r.mrr },
    { key: "status", label: "Status",
      render: r => pill(r.status, tone(r.status)) },
  ],
  rows, rowKey: r => r.id,
  pageSize: 5,
  selectable: true,          // leading checkbox column
  exportable: true,          // CSV · XLS · XLSX menu
  stickyHeader: true,
  striped: true,
  onRow: r => open(r),       // click a row
  onSelectionChange: keys => console.log(keys),
});`,
    demo: () =>
      dataTable<Company>({
        title: "Companies",
        columns: [
          { key: "company", label: "Company", sortable: true },
          { key: "plan", label: "Plan" },
          { key: "mrr", label: "MRR", numeric: true, sortable: true, value: (r) => r.mrr, render: (r) => `$${r.mrr}` },
          { key: "status", label: "Status", render: (r) => pill(r.status, r.status === "Active" ? "pos" : r.status === "Trial" ? "mut" : "neg") },
        ],
        rows: COMPANIES,
        rowKey: (r) => r.id,
        pageSize: 5,
        selectable: true,
        exportable: true,
        striped: true,
      }),
    populateNote: "Populate it with a plain array + a rowKey. Columns map by `key`; use `value` for sort/export and `render` for custom cells. Pass an accessor `() => rows()` to make it reactive.",
    populateCode: `interface Company {
  id: string; company: string; plan: string; mrr: number; status: string;
}

const rows: Company[] = [
  { id: "1", company: "Acme",   plan: "Team", mrr: 490,  status: "Active" },
  { id: "2", company: "Globex", plan: "Solo", mrr: 120,  status: "Trial"  },
  // …
];

// Reactive source (updates re-render surgically):
const rows = signal<Company[]>([]);
fetch("/api/companies").then(r => r.json()).then(rows.set);
dataTable({ columns, rows: () => rows(), rowKey: r => r.id });`,
    props: [
      { name: "columns", type: "Column<T>[]", desc: "key · label · sortable? · numeric? · align? · value(row) · render(row)." },
      { name: "rows", type: "Maybe<T[]>", desc: "Array or accessor () => T[]." },
      { name: "rowKey", type: "(row) => string|number", desc: "Stable identity per row (keyed updates)." },
      { name: "pageSize", type: "number", desc: "Rows per page (default 10)." },
      { name: "search", type: "boolean", desc: "Toolbar search (default on)." },
      { name: "selectable", type: "boolean", desc: "Leading checkbox column; header toggles all on the page." },
      { name: "onSelectionChange", type: "(keys) => void", desc: "Fires with the selected rowKeys." },
      { name: "onRow", type: "(row) => void", desc: "Click a row." },
      { name: "exportable", type: "boolean | {filename,formats}", desc: "CSV/XLS/XLSX export of the filtered view." },
      { name: "loading", type: "Maybe<boolean>", desc: "Show skeleton rows." },
      { name: "stickyHeader / striped / density", type: "boolean / \"compact\"", desc: "Presentation toggles." },
    ],
  },
  // ---- tableList (datalist) ----
  {
    id: "c-tablelist",
    name: "tableList",
    pkg: "@dxjs/ui",
    lead: "The lighter sibling of dataTable: an unpaginated list with optional sort, selection, export, loading and density — ideal for compact panels.",
    importLine: 'import { tableList } from "@dxjs/ui";',
    usageCode: `tableList<Company>({
  title: "Accounts",
  columns: [
    { key: "company", label: "Company", sortable: true },
    { key: "plan", label: "Plan" },
    { key: "mrr", label: "MRR", numeric: true, value: r => r.mrr },
  ],
  rows, rowKey: r => r.id,
  selectable: true,
  exportable: true,
  density: "compact",
});`,
    demo: () =>
      tableList<Company>({
        title: "Accounts",
        columns: [
          { key: "company", label: "Company", sortable: true },
          { key: "plan", label: "Plan" },
          { key: "mrr", label: "MRR", numeric: true, value: (r) => r.mrr, render: (r) => `$${r.mrr}` },
        ],
        rows: COMPANIES,
        rowKey: (r) => r.id,
        selectable: true,
        exportable: true,
        density: "compact",
      }),
    populateNote: "Same shape as dataTable — columns + rows + rowKey — but no paging. Add `sortable` per column for click-to-sort.",
    populateCode: `const rows = [
  { id: "1", company: "Acme", plan: "Team", mrr: 490 },
  { id: "2", company: "Globex", plan: "Solo", mrr: 120 },
];
tableList({
  columns: [{ key: "company", label: "Company" }, { key: "mrr", label: "MRR", numeric: true }],
  rows, rowKey: r => r.id,
});`,
    props: [
      { name: "columns / rows / rowKey", type: "—", desc: "Same as dataTable." },
      { name: "sortable (per column)", type: "boolean", desc: "Click-to-sort with aria-sort + keyboard." },
      { name: "selectable / onSelectionChange", type: "—", desc: "Checkbox selection." },
      { name: "exportable", type: "boolean | {…}", desc: "CSV/XLS/XLSX." },
      { name: "loading / density / striped", type: "—", desc: "Skeleton rows · compact · zebra." },
    ],
  },
  // ---- calendar ----
  {
    id: "c-calendar",
    name: "calendar",
    pkg: "@dxjs/ui",
    lead: "A smart month calendar: UTC-correct, Intl-localized, with a built-in + pluggable holiday engine (knows Angola's public days) and event dots.",
    importLine: 'import { calendar } from "@dxjs/ui";',
    usageCode: `calendar({
  value: () => selected(),
  onSelect: iso => selected.set(iso),
  locale: "pt-AO",           // Intl names + built-in holidays
  holidays: true,            // or a custom provider(year)
  events: [{ date: "2026-11-20", title: "Deploy", tone: "info" }],
});`,
    demo: () => {
      const sel = signal("2026-11-11");
      return calendar({
        value: () => sel(),
        onSelect: (d) => sel.set(d),
        locale: "pt-AO",
        holidays: true,
        events: [
          { date: "2026-11-20", title: "Deploy", tone: "info" },
          { date: "2026-11-25", title: "Review", tone: "warn" },
        ],
      });
    },
    populateNote: "Events are a plain array of { date, title, tone? }. Holidays come from the offline engine (holidaysFor) or your own provider — no network needed.",
    populateCode: `import { calendar, registerHolidays } from "@dxjs/ui";

const events = [
  { date: "2026-11-20", title: "Deploy", tone: "info" },
  { date: "2026-12-25", title: "Natal", tone: "pos" },
];

// Teach it another region's holidays (offline, UTC):
registerHolidays("fr-FR", y => [{ date: y + "-07-14", name: "Fête nationale", type: "public" }]);
calendar({ locale: "fr-FR", holidays: true, events });`,
    props: [
      { name: "value / onSelect", type: "Maybe<string> / (iso)=>void", desc: "Selected ISO date." },
      { name: "events", type: "Maybe<CalendarEvent[]>", desc: "{ date, title, tone? } dots." },
      { name: "locale", type: "string", desc: "Intl names + built-in holiday set (default pt-AO)." },
      { name: "holidays", type: "boolean | provider", desc: "Built-in for locale, or your own (year)=>Holiday[]." },
      { name: "weekStart", type: "0 | 1", desc: "Sunday (default) or Monday." },
    ],
  },
  // ---- searchFilter (Ctrl+K) ----
  {
    id: "c-searchfilter",
    name: "searchFilter",
    pkg: "@dxjs/ui",
    lead: "An Odoo-style search & filter bar: type-to-facet chips, Filters and Group By menus, and a Ctrl/⌘+K hotkey to focus it.",
    importLine: 'import { searchFilter, matchFacets } from "@dxjs/ui";',
    usageCode: `searchFilter({
  fields: [{ key: "name", label: "Name" }, { key: "city", label: "City" }],
  filters: [{ id: "active", label: "Active" }],
  groupBy: [{ id: "plan", label: "Plan" }],
  onChange: state => applied.set(state),   // { facets, filters, groupBy }
});`,
    demo: () =>
      searchFilter({
        fields: [{ key: "name", label: "Name" }, { key: "city", label: "City" }],
        filters: [{ id: "active", label: "Active" }, { id: "trial", label: "Trial" }],
        groupBy: [{ id: "plan", label: "Plan" }, { id: "city", label: "City" }],
        placeholder: "Search… (Ctrl/⌘ + K)",
      }),
    populateNote: "onChange hands you { facets, filters, groupBy }. Filter rows with the pure `matchFacets` helper (OR within a field, AND across fields).",
    populateCode: `const applied = signal({ facets: [], filters: [], groupBy: [] });
const shown = computed(() =>
  rows().filter(r => matchFacets(r, applied().facets, (row, f) => String(row[f]))));

searchFilter({ fields, filters, onChange: applied.set });`,
    props: [
      { name: "fields", type: "{key,label}[]", desc: "Searchable fields → facet suggestions." },
      { name: "filters / groupBy", type: "{id,label}[]", desc: "Predefined menus." },
      { name: "onChange", type: "(SearchState)=>void", desc: "{ facets, filters, groupBy }." },
      { name: "hotkey", type: "boolean", desc: "Ctrl/⌘+K focus (default on)." },
    ],
  },
  // ---- metric ----
  {
    id: "c-metrics",
    name: "metricGrid",
    pkg: "@dxjs/ui",
    lead: "Rich KPI tiles with value, delta arrow, inline sparkline and optional click — a responsive grid.",
    importLine: 'import { metric, metricGrid } from "@dxjs/ui";',
    usageCode: `metricGrid([
  { label: "MRR", value: "$62,350", delta: "+12.4%", tone: "pos",
    trend: [40,44,42,50,55,62], icon: "$" },
  { label: "Churn", value: "2.1%", delta: "-0.3%", tone: "neg",
    trend: [4,3.5,3,2.8,2.4,2.1] },
]);`,
    demo: () =>
      metricGrid([
        { label: "MRR", value: "$62,350", delta: "+12.4%", tone: "pos", trend: [40, 44, 42, 50, 55, 62], icon: "$" },
        { label: "Active", value: "3,920", delta: "+5.1%", tone: "pos", trend: [30, 32, 31, 36, 38, 39] },
        { label: "Churn", value: "2.1%", delta: "-0.3%", tone: "neg", trend: [4, 3.5, 3, 2.8, 2.4, 2.1] },
      ]),
    populateCode: `const metrics = [
  { label: "MRR", value: fmtMoney(mrr()), delta: "+12.4%", tone: "pos", trend: history() },
];
metricGrid(metrics);   // or a single metric({ … })`,
    props: [
      { name: "label / value", type: "string / Maybe<string|number>", desc: "The KPI." },
      { name: "delta / tone", type: "Maybe<string> / Tone", desc: "Change + colour (pos→▲, neg→▼)." },
      { name: "trend", type: "Maybe<number[]>", desc: "Inline sparkline." },
      { name: "icon / onClick", type: "—", desc: "Leading glyph · clickable tile." },
    ],
  },
  // ---- gantt ----
  {
    id: "c-gantt",
    name: "gantt",
    pkg: "@dxjs/ui",
    lead: "A compact timeline of tasks with % bars and progress, drawn as CSP-safe SVG.",
    importLine: 'import { gantt } from "@dxjs/ui";',
    usageCode: `gantt({
  tasks: [
    { id: "d", label: "Design", start: "2026-11-02", end: "2026-11-08", tone: "info", progress: 100 },
    { id: "b", label: "Build",  start: "2026-11-06", end: "2026-11-20", tone: "pos", progress: 60 },
    { id: "s", label: "Ship",   start: "2026-11-20", end: "2026-11-27", tone: "warn", progress: 10 },
  ],
});`,
    demo: () =>
      gantt({
        tasks: [
          { id: "d", label: "Design", start: "2026-11-02", end: "2026-11-08", tone: "info", progress: 100 },
          { id: "b", label: "Build", start: "2026-11-06", end: "2026-11-20", tone: "pos", progress: 60 },
          { id: "s", label: "Ship", start: "2026-11-20", end: "2026-11-27", tone: "warn", progress: 10 },
        ],
      }),
    populateCode: `const tasks = milestones().map(m => ({
  id: m.id, label: m.name, start: m.start, end: m.due,
  tone: m.late ? "neg" : "pos", progress: m.pct,
}));
gantt({ tasks });`,
    props: [
      { name: "tasks", type: "Maybe<Task[]>", desc: "{ id, label, start, end, tone?, progress? } (ISO dates)." },
      { name: "start / end", type: "string", desc: "Overall range (defaults to min/max of tasks)." },
    ],
  },
  // ---- planner ----
  {
    id: "c-planner",
    name: "planner",
    pkg: "@dxjs/ui",
    lead: "A weekly agenda grid: a time gutter + 7 day columns with positioned event blocks.",
    importLine: 'import { planner } from "@dxjs/ui";',
    usageCode: `planner({
  dayLabels: ["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"],
  events: [
    { id: "a", day: 1, start: "09:00", end: "10:30", title: "Standup", tone: "info" },
    { id: "b", day: 3, start: "14:00", end: "16:00", title: "Deploy", tone: "pos" },
  ],
});`,
    demo: () =>
      planner({
        dayLabels: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"],
        events: [
          { id: "a", day: 1, start: "09:00", end: "10:30", title: "Standup", tone: "info" },
          { id: "b", day: 3, start: "14:00", end: "16:00", title: "Deploy", tone: "pos" },
          { id: "c", day: 5, start: "11:00", end: "12:00", title: "1:1", tone: "warn" },
        ],
      }),
    populateCode: `const events = bookings().map(b => ({
  id: b.id, day: b.weekday, start: b.from, end: b.to, title: b.who, tone: "info",
}));
planner({ events, startHour: 8, endHour: 18 });`,
    props: [
      { name: "events", type: "Maybe<Event[]>", desc: "{ id, day(0-6), start 'HH:MM', end, title, tone? }." },
      { name: "weekStart / dayLabels", type: "0|1 / string[]", desc: "Localizable week." },
      { name: "startHour / endHour", type: "number", desc: "Visible hour span (default 7–19)." },
    ],
  },
  // ---- searchableSelect ----
  {
    id: "c-select2",
    name: "searchableSelect",
    pkg: "@dxjs/ui",
    lead: "A combobox with type-to-filter and single or multi selection (select2-style), CSP-safe.",
    importLine: 'import { searchableSelect } from "@dxjs/ui";',
    usageCode: `searchableSelect({
  multiple: true,
  options: [{ value: "a", label: "Apple" }, { value: "b", label: "Banana" }],
  value: () => picked(),
  onChange: v => picked.set(v),   // string | string[]
});`,
    demo: () => {
      const picked = signal<string[]>(["b"]);
      return searchableSelect({
        multiple: true,
        options: [{ value: "a", label: "Apple" }, { value: "b", label: "Banana" }, { value: "c", label: "Cherry" }, { value: "d", label: "Date" }],
        value: () => picked(),
        onChange: (v) => picked.set(v as string[]),
      });
    },
    populateCode: `const options = tags().map(t => ({ value: t.id, label: t.name }));
searchableSelect({ options, value: () => sel(), onChange: sel.set });`,
    props: [
      { name: "options", type: "Maybe<{value,label}[]>", desc: "The choices." },
      { name: "value / onChange", type: "Maybe<string|string[]>", desc: "Single or (multiple) array." },
      { name: "multiple", type: "boolean", desc: "Multi-select with chips." },
    ],
  },
  // ---- button ----
  {
    id: "c-button",
    name: "button",
    pkg: "@dxjs/ui",
    lead: "A button with variants (primary · default · ghost · subtle · danger), the xs→xxl size scale, loading and icons.",
    importLine: 'import { button } from "@dxjs/ui";',
    usageCode: `button({ label: "Deploy", variant: "primary", size: "md", onClick: deploy });
button({ label: "Delete", variant: "danger", size: "sm" });
button({ label: "Saving…", variant: "primary", loading: true });`,
    demo: () => html`<div class="gl-row">
      ${button({ label: "Primary", variant: "primary" })}
      ${button({ label: "Default" })}
      ${button({ label: "Ghost", variant: "ghost" })}
      ${button({ label: "Danger", variant: "danger" })}
      ${button({ label: "Loading", variant: "primary", loading: true })}
    </div>`,
    populateCode: `// sizes: "xs" | "sm" | "md" | "lg" | "xl" | "xxl"  (≡ 1..6)
["xs","sm","md","lg","xl","xxl"].map(s => button({ label: s, size: s }));`,
    props: [
      { name: "label", type: "Maybe<string>", desc: "Text (omit for an icon-only button)." },
      { name: "variant", type: "ButtonVariant", desc: "primary · default · ghost · subtle · danger." },
      { name: "size", type: "Size", desc: "xs·sm·md·lg·xl·xxl or 1..6." },
      { name: "loading / disabled", type: "Maybe<boolean>", desc: "Busy spinner · disabled." },
      { name: "icon / onClick", type: "—", desc: "Leading content · click handler." },
    ],
  },
  // ---- field / input ----
  {
    id: "c-field",
    name: "field",
    pkg: "@dxjs/ui",
    lead: "A labelled input with hint/error wiring (a11y), built on the base input. Plus select, switch, checkbox, radioGroup.",
    importLine: 'import { field, input, select, switchToggle, checkbox } from "@dxjs/ui";',
    usageCode: `field({ label: "Email", placeholder: "you@ngola.ao",
  hint: "we never share it",
  error: () => emailError() });

switchToggle({ checked: () => on(), onChange: on.set, label: "Notifications" });`,
    demo: () => {
      const on = signal(true);
      const plan = signal("team");
      return html`<div class="gl-stack">
        ${field({ label: "Email", placeholder: "you@ngola.ao", hint: "we never share it" })}
        ${select({ options: [{ value: "solo", label: "Solo" }, { value: "team", label: "Team" }], value: () => plan(), onChange: (v) => plan.set(v) })}
        ${switchToggle({ checked: () => on(), onChange: (c) => on.set(c), label: "Notifications" })}
        ${checkbox({ checked: () => false, label: "I agree" })}
      </div>`;
    },
    populateCode: `// Controlled by signals:
const email = signal("");
field({ label: "Email", value: () => email(), onInput: email.set });`,
    props: [
      { name: "label", type: "string", desc: "Field label (wired to the control)." },
      { name: "value / onInput", type: "Maybe<string> / (v)=>void", desc: "Controlled value." },
      { name: "hint / error", type: "string / Maybe<string|false>", desc: "Help · reactive error." },
      { name: "required / size", type: "boolean / Size", desc: "Mark required · density." },
    ],
  },
  // ---- starRating ----
  {
    id: "c-rating",
    name: "starRating",
    pkg: "@dxjs/ui",
    lead: "An accessible star rating — interactive or read-only, with optional half-stars and the size scale.",
    importLine: 'import { starRating } from "@dxjs/ui";',
    usageCode: `starRating({ value: () => stars(), onChange: stars.set, size: "lg" });
starRating({ value: 4, max: 5 });   // read-only (no onChange)`,
    demo: () => {
      const stars = signal(3);
      return html`<div class="gl-stack">
        ${starRating({ value: () => stars(), onChange: (v) => stars.set(v), size: "lg" })}
        ${starRating({ value: 4, max: 5 })}
      </div>`;
    },
    populateCode: `const stars = signal(product.rating);
starRating({ value: () => stars(), onChange: v => rate(product.id, v) });`,
    props: [
      { name: "value / onChange", type: "Maybe<number> / (v)=>void", desc: "Omit onChange ⇒ read-only." },
      { name: "max / allowHalf", type: "number / boolean", desc: "Stars count · half steps." },
      { name: "size", type: "Size", desc: "xs..xxl." },
    ],
  },
  // ---- worldMap ----
  {
    id: "c-map",
    name: "worldMap",
    pkg: "@dxjs/ui",
    lead: "A self-contained SVG world map (no external tiles) that plots markers by longitude/latitude — CSP-safe.",
    importLine: 'import { worldMap } from "@dxjs/ui";',
    usageCode: `worldMap({
  markers: [
    { lon: 13.23, lat: -8.84, label: "Luanda", tone: "pos" },
    { lon: -9.14, lat: 38.72, label: "Lisboa", tone: "info" },
  ],
});`,
    demo: () =>
      worldMap({
        markers: [
          { lon: 13.23, lat: -8.84, label: "Luanda", tone: "pos" },
          { lon: -9.14, lat: 38.72, label: "Lisboa", tone: "info" },
          { lon: -46.63, lat: -23.55, label: "São Paulo", tone: "warn" },
          { lon: 2.35, lat: 48.86, label: "Paris" },
        ],
      }),
    populateCode: `const markers = sites().map(s => ({
  lon: s.lng, lat: s.lat, label: s.city, tone: s.healthy ? "pos" : "neg",
}));
worldMap({ markers, graticule: true });`,
    props: [
      { name: "markers", type: "Maybe<Marker[]>", desc: "{ lon, lat, label?, tone? } — equirectangular projection." },
      { name: "graticule", type: "boolean", desc: "Draw the lon/lat grid (default on)." },
    ],
  },
  // ---- carousel ----
  {
    id: "c-carousel",
    name: "carousel",
    pkg: "@dxjs/ui",
    lead: "A slide carousel with arrows, dots, keyboard and optional autoplay.",
    importLine: 'import { carousel } from "@dxjs/ui";',
    usageCode: `carousel({
  slides: [slideA, slideB, slideC],   // TemplateResult[]
  autoplayMs: 4000,                    // optional
});`,
    demo: () =>
      carousel({
        slides: [
          html`<div class="gl-slide">Slide 1 — reactive</div>`,
          html`<div class="gl-slide">Slide 2 — CSP-safe</div>`,
          html`<div class="gl-slide">Slide 3 — tiny</div>`,
        ],
      }),
    populateCode: `const slides = banners().map(b => html\`<img class="dx-img-el" src=\${b.url} alt=\${b.alt} />\`);
carousel({ slides, autoplayMs: 5000 });`,
    props: [
      { name: "slides", type: "Maybe<TemplateResult[]>", desc: "The slides." },
      { name: "autoplayMs", type: "number", desc: "Auto-advance (pauses on hover)." },
      { name: "showDots / showArrows", type: "boolean", desc: "Controls (default on)." },
    ],
  },
];

export const componentPages: Page[] = componentDocs.map(makeComponentPage);
