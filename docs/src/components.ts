// One page per component — the delonix docs pattern. Each page has a "Usar" (usage
// code + a live demo you can flip Desktop/Mobile) and a "Popular" section (the data
// shape + how to feed it), plus a props table. Driven by a registry so coverage is
// broad and consistent. Live demos are created inside the page component (so signals
// /onMount work), shown through the device preview.
import { signal } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { component, type Component } from "@dxjs/component";
import {
  button, buttonGroup, badge, pill, input, textarea, field, select, switchToggle,
  checkbox, radioGroup, tagsInput, card, appShell, statCard, statGrid,
  alert, modal, tooltip, skeleton, spinner, progress, meter, topProgress, emptyState,
  tabs, segmented, breadcrumb, navPanel, avatar, divider, stack, grid, space, splitter,
  drawer, dropdown, accordion, stepper, timeline, popover, popconfirm, contextMenu, pagination,
  dataTable, tableList, exportMenu, virtualList, sparkline, metric, metricGrid,
  calendar, datePicker, dateRangePicker, timer, slider, numberInput, timePicker,
  searchFilter, searchableSelect, icon,
  gantt, planner, kanban, taskPanel, commandPalette, fileUpload,
  image, video, carousel, worldMap, starRating, descriptionList, tree,
  bottomSheet, actionSheet, tabBar, fab, swipeActions, pullToRefresh, pickerWheel,
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
  // ======================================================================
  // UI · Controls
  // ======================================================================
  // ---- buttonGroup ----
  {
    id: "c-buttongroup",
    name: "buttonGroup",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A horizontal group of buttons with joined borders, for segmented actions like a date range.",
    importLine: `import { buttonGroup } from "@dxjs/ui";`,
    usageCode: `buttonGroup([
  button({ label: "Day", variant: "subtle" }),
  button({ label: "Week", variant: "subtle" }),
  button({ label: "Month", variant: "subtle" }),
]);`,
    demo: () =>
      html`<div class="gl-row">${buttonGroup([
        button({ label: "Day", variant: "subtle" }),
        button({ label: "Week", variant: "subtle" }),
        button({ label: "Month", variant: "subtle" }),
      ])}</div>`,
    populateCode: `// buttonGroup takes an array of button() templates (positional, not an options object).
const range = signal("week");
buttonGroup(["day", "week", "month"].map((r) =>
  button({ label: r, variant: "subtle", onClick: () => range.set(r) }),
));`,
    populateNote: "The argument is a plain array of button templates; group styling joins their borders.",
    props: [
      { name: "buttons", type: "TemplateResult[]", desc: "The buttons to join, in order (positional argument, not an options object)." },
    ],
  },
  // ---- badge ----
  {
    id: "c-badge",
    name: "badge",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A compact, squared status label — the squared counterpart to the rounded pill.",
    importLine: `import { badge } from "@dxjs/ui";`,
    usageCode: `badge("NEW", "info");`,
    demo: () =>
      html`<div class="gl-row">
        ${badge("NEW", "info")}
        ${badge("OK", "pos")}
        ${badge("WARN", "warn")}
        ${badge("DOWN", "neg")}
      </div>`,
    populateCode: `// Positional args: badge(label, tone). Tone is one of pos | neg | warn | mut | info.
badge("Beta", "warn");
badge("v2", "mut");
// The label may be a reactive accessor:
const count = signal(3);
badge(() => \`\${count()} new\`, "info");`,
    populateNote: "badge(label, tone) takes positional arguments — not an options object.",
    props: [
      { name: "label", type: "Maybe<string>", desc: "The badge text; a static string or a reactive accessor." },
      { name: "tone", type: "Tone", desc: "Colour tone: pos | neg | warn | mut | info. Defaults to \"mut\"." },
    ],
  },
  // ---- input ----
  {
    id: "c-input",
    name: "input",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A bare, styled text input bound to a value accessor and an onInput callback.",
    importLine: `import { input } from "@dxjs/ui";`,
    usageCode: `const name = signal("");
input({ value: name, onInput: (v) => name.set(v), placeholder: "Your name" });`,
    demo: () => {
      const name = signal("");
      return html`<div class="gl-stack">
        ${input({ value: name, onInput: (v) => name.set(v), placeholder: "Your name" })}
      </div>`;
    },
    populateCode: `const email = signal("");
input({
  value: email,
  onInput: (v) => email.set(v),
  type: "email",
  placeholder: "you@example.com",
  invalid: () => email().length > 0 && !email().includes("@"),
  size: "lg",
});`,
    populateNote: "Controlled: pass a signal to value and write it back in onInput.",
    props: [
      { name: "value", type: "Maybe<string>", desc: "Current value; a string or reactive accessor (controlled input)." },
      { name: "onInput", type: "(value: string, e: Event) => void", desc: "Fires on every keystroke with the new value." },
      { name: "type", type: `"text" | "email" | "password" | "search" | "number"`, desc: "Native input type. Defaults to \"text\"." },
      { name: "invalid", type: "Maybe<boolean>", desc: "When true, sets aria-invalid and the error styling." },
      { name: "size", type: "Size", desc: "Density tier xs–xxl (or 1–6). Defaults to md." },
      { name: "placeholder", type: "string", desc: "Placeholder text shown when empty." },
    ],
  },
  // ---- textarea ----
  {
    id: "c-textarea",
    name: "textarea",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A multi-line text input — the same options as input plus a rows count.",
    importLine: `import { textarea } from "@dxjs/ui";`,
    usageCode: `const notes = signal("");
textarea({ value: notes, onInput: (v) => notes.set(v), rows: 3 });`,
    demo: () => {
      const notes = signal("");
      return html`<div class="gl-stack">
        ${textarea({ value: notes, onInput: (v) => notes.set(v), rows: 3, placeholder: "Notas…" })}
      </div>`;
    },
    populateCode: `const notes = signal("");
textarea({
  value: notes,
  onInput: (v) => notes.set(v),
  rows: 5,
  placeholder: "Describe the incident…",
});`,
    populateNote: "textarea takes every input option except type, adding rows.",
    props: [
      { name: "value", type: "Maybe<string>", desc: "Current value; a string or reactive accessor (controlled)." },
      { name: "onInput", type: "(value: string, e: Event) => void", desc: "Fires on every keystroke with the new value." },
      { name: "rows", type: "number", desc: "Visible rows. Defaults to 3." },
      { name: "placeholder", type: "string", desc: "Placeholder text shown when empty." },
      { name: "invalid", type: "Maybe<boolean>", desc: "When true, sets aria-invalid and the error styling." },
    ],
  },
  // ---- select ----
  {
    id: "c-select",
    name: "select",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A styled native <select>, keyboard and accessibility handling for free.",
    importLine: `import { select } from "@dxjs/ui";`,
    usageCode: `const country = signal("ao");
select({
  value: country,
  onChange: (v) => country.set(v),
  options: [
    { value: "ao", label: "Angola" },
    { value: "pt", label: "Portugal" },
    { value: "br", label: "Brasil" },
  ],
});`,
    demo: () => {
      const country = signal("ao");
      return html`<div class="gl-stack">
        ${select({
          value: country,
          onChange: (v) => country.set(v),
          options: [
            { value: "ao", label: "Angola" },
            { value: "pt", label: "Portugal" },
            { value: "br", label: "Brasil" },
          ],
        })}
      </div>`;
    },
    populateCode: `const plan = signal("");
select({
  value: plan,
  onChange: (v) => plan.set(v),
  placeholder: "Choose a plan",
  options: [
    { value: "free", label: "Free" },
    { value: "growth", label: "Growth" },
    { value: "ent", label: "Enterprise", disabled: true },
  ],
});`,
    populateNote: "options is an array of { value, label, disabled? }; placeholder adds a leading disabled option.",
    props: [
      { name: "options", type: "Maybe<SelectOption[]>", desc: "Choices, each { value, label, disabled? }. May be a reactive accessor." },
      { name: "value", type: "Maybe<string>", desc: "Selected value; a string or reactive accessor." },
      { name: "onChange", type: "(value: string) => void", desc: "Fires with the newly selected value." },
      { name: "placeholder", type: "string", desc: "Optional leading disabled option shown when nothing is selected." },
      { name: "size", type: "Size", desc: "Density tier xs–xxl (or 1–6). Defaults to md." },
    ],
  },
  // ---- switchToggle ----
  {
    id: "c-switch",
    name: "switchToggle",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A toggle switch (role=switch) whose state lives in aria-checked, read by CSS.",
    importLine: `import { switchToggle } from "@dxjs/ui";`,
    usageCode: `const on = signal(true);
switchToggle({ checked: on, onChange: (v) => on.set(v), label: "Notifications" });`,
    demo: () => {
      const on = signal(true);
      return html`<div class="gl-stack">
        ${switchToggle({ checked: on, onChange: (v) => on.set(v), label: "Notifications" })}
      </div>`;
    },
    populateCode: `const dark = signal(false);
switchToggle({
  checked: dark,
  onChange: (v) => dark.set(v),
  label: "Dark mode",
  disabled: false,
});`,
    populateNote: "Controlled: checked is a boolean accessor, onChange receives the next boolean.",
    props: [
      { name: "checked", type: "Maybe<boolean>", desc: "Current on/off state; a boolean or reactive accessor." },
      { name: "onChange", type: "(checked: boolean) => void", desc: "Fires with the next state when toggled." },
      { name: "label", type: "string", desc: "Optional visible label next to the switch." },
      { name: "disabled", type: "Maybe<boolean>", desc: "When true, blocks interaction." },
    ],
  },
  // ---- checkbox ----
  {
    id: "c-checkbox",
    name: "checkbox",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A styled checkbox bound to a checked accessor and an onChange callback.",
    importLine: `import { checkbox } from "@dxjs/ui";`,
    usageCode: `const agreed = signal(false);
checkbox({ checked: agreed, onChange: (v) => agreed.set(v), label: "I agree" });`,
    demo: () => {
      const agreed = signal(false);
      return html`<div class="gl-stack">
        ${checkbox({ checked: agreed, onChange: (v) => agreed.set(v), label: "I agree" })}
      </div>`;
    },
    populateCode: `const remember = signal(true);
checkbox({
  checked: remember,
  onChange: (v) => remember.set(v),
  label: "Remember this device",
});`,
    populateNote: "Supply ariaLabel instead of label when there is no visible text.",
    props: [
      { name: "checked", type: "Maybe<boolean>", desc: "Current checked state; a boolean or reactive accessor." },
      { name: "onChange", type: "(checked: boolean) => void", desc: "Fires with the next state when toggled." },
      { name: "label", type: "string", desc: "Optional visible label." },
      { name: "ariaLabel", type: "string", desc: "Accessible name when there is no visible label." },
      { name: "disabled", type: "Maybe<boolean>", desc: "When true, blocks interaction." },
    ],
  },
  // ---- radioGroup ----
  {
    id: "c-radio",
    name: "radioGroup",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A single-choice radio group bound to a value accessor and an onChange callback.",
    importLine: `import { radioGroup } from "@dxjs/ui";`,
    usageCode: `const range = signal("week");
radioGroup({
  value: range,
  onChange: (v) => range.set(v),
  options: [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
  ],
});`,
    demo: () => {
      const range = signal("week");
      return html`<div class="gl-stack">
        ${radioGroup({
          value: range,
          onChange: (v) => range.set(v),
          options: [
            { value: "day", label: "Day" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ],
        })}
      </div>`;
    },
    populateCode: `const plan = signal("growth");
radioGroup({
  value: plan,
  onChange: (v) => plan.set(v),
  ariaLabel: "Billing plan",
  options: [
    { value: "free", label: "Free" },
    { value: "growth", label: "Growth" },
    { value: "ent", label: "Enterprise", disabled: true },
  ],
});`,
    populateNote: "options is an array of { value, label, disabled? }; value holds the selected option.",
    props: [
      { name: "options", type: "Maybe<RadioOption[]>", desc: "Choices, each { value, label, disabled? }. May be a reactive accessor." },
      { name: "value", type: "Maybe<string>", desc: "Selected value; a string or reactive accessor." },
      { name: "onChange", type: "(value: string) => void", desc: "Fires with the newly selected value." },
      { name: "name", type: "string", desc: "Shared radio group name; auto-generated when omitted." },
      { name: "ariaLabel", type: "string", desc: "Accessible name for the radiogroup." },
    ],
  },
  // ---- tagsInput ----
  {
    id: "c-tagsinput",
    name: "tagsInput",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A token entry field: type and press Enter (or comma) to add a tag, Backspace removes the last.",
    importLine: `import { tagsInput } from "@dxjs/ui";`,
    usageCode: `const tags = signal(["luanda", "ops"]);
tagsInput({ value: tags, onChange: (t) => tags.set(t), placeholder: "Add a tag…" });`,
    demo: () => {
      const tags = signal<string[]>(["luanda", "ops"]);
      return html`<div class="gl-stack">
        ${tagsInput({ value: tags, onChange: (t) => tags.set(t), placeholder: "Add a tag…" })}
      </div>`;
    },
    populateCode: `const tags = signal<string[]>([]);
tagsInput({
  value: tags,
  onChange: (t) => tags.set(t),
  placeholder: "Add a tag…",
  unique: true,
  separators: [",", " "],
});`,
    populateNote: "Controlled via value + onChange; separators default to comma (Enter always commits).",
    props: [
      { name: "value", type: "Maybe<string[]>", desc: "Current tags; a string array or reactive accessor." },
      { name: "onChange", type: "(tags: string[]) => void", desc: "Fires with the full tag list after each add/remove." },
      { name: "unique", type: "boolean", desc: "Reject duplicate tags. Defaults to true." },
      { name: "separators", type: "string[]", desc: "Keys that commit the draft into a tag. Defaults to [\",\"] (Enter always commits)." },
      { name: "placeholder", type: "string", desc: "Placeholder for the draft input." },
    ],
  },
  // ---- pill ----
  {
    id: "c-pill",
    name: "pill",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A rounded status pill — the rounded counterpart to the squared badge.",
    importLine: `import { pill } from "@dxjs/ui";`,
    usageCode: `pill("active", "pos");`,
    demo: () =>
      html`<div class="gl-row">
        ${pill("active", "pos")}
        ${pill("paused", "mut")}
        ${pill("over quota", "warn")}
      </div>`,
    populateCode: `// Positional args: pill(label, tone). Tone is one of pos | neg | warn | mut | info.
pill("online", "pos");
pill("degraded", "warn");
pill("offline", "neg");`,
    populateNote: "pill(label, tone) takes positional arguments — not an options object.",
    props: [
      { name: "label", type: "string", desc: "The pill text." },
      { name: "tone", type: "Tone", desc: "Colour tone: pos | neg | warn | mut | info. Defaults to \"mut\"." },
    ],
  },
  // ---- card ----
  {
    id: "c-card",
    name: "card",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A surface with an optional title and arbitrary body content.",
    importLine: `import { card } from "@dxjs/ui";`,
    usageCode: `card({
  title: "Fleet summary",
  body: html\`<p>128 active devices · 3 offline · 2 quarantined.</p>\`,
});`,
    demo: () =>
      html`<div class="gl-stack">
        ${card({
          title: "Resumo da frota",
          body: html`<p>128 dispositivos activos · 3 offline · 2 em quarentena.</p>`,
        })}
      </div>`,
    populateCode: `card({
  title: "Billing",
  body: html\`<div class="gl-stack">
    <p>Current plan: Enterprise.</p>
    \${pill("active", "pos")}
  </div>\`,
});`,
    populateNote: "body is any TemplateResult (or a reactive accessor); title is optional.",
    props: [
      { name: "title", type: "string", desc: "Optional heading rendered in the card header." },
      { name: "body", type: "Maybe<TemplateResult>", desc: "Card content; a template or reactive accessor." },
    ],
  },
  // ---- appShell ----
  {
    id: "c-appshell",
    name: "appShell",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A dashboard shell: dark sidebar nav plus a top bar (search/topbar and user) over the content.",
    importLine: `import { appShell } from "@dxjs/ui";`,
    usageCode: `appShell({
  brand: "Sentinel",
  nav: [
    { label: "Dashboard", active: true, onSelect: () => {} },
    { label: "Devices", onSelect: () => {} },
  ],
  user: { name: "Jane Doe", initials: "JD" },
  search: { placeholder: "Search…", onInput: () => {} },
  content: html\`<h1>Dashboard</h1>\`,
});`,
    demo: () =>
      html`<div class="gl-stack">
        ${appShell({
          brand: "Sentinel",
          nav: [
            { label: "Painel", active: true, onSelect: () => {} },
            { label: "Dispositivos", onSelect: () => {} },
            { label: "Eventos", onSelect: () => {} },
          ],
          user: { name: "Jane Doe", initials: "JD" },
          search: { placeholder: "Procurar…", onInput: () => {} },
          content: html`<div class="gl-stack">
            <h1>Painel</h1>
            ${statGrid([
              { label: "Dispositivos", value: "128", delta: "+4", tone: "pos" },
              { label: "Offline", value: "3", tone: "warn" },
            ])}
          </div>`,
        })}
      </div>`,
    populateCode: `appShell({
  brand: "Sentinel",
  nav: items,
  user: { name: "Jane Doe", initials: "JD" },
  // topbar replaces search when no search is given:
  topbar: html\`<div class="toolbar">…</div>\`,
  content: html\`<main>…</main>\`,
});`,
    populateNote: "Responsive: below ~860px the sidebar becomes a slide-in drawer toggled by a hamburger.",
    props: [
      { name: "brand", type: "string", desc: "Brand/product name shown at the top of the sidebar." },
      { name: "nav", type: "Maybe<NavItem[]>", desc: "Sidebar items, each { label, active?, onSelect? }." },
      { name: "user", type: "{ name: string; initials: string }", desc: "Optional user chip in the top bar." },
      { name: "search", type: "{ placeholder?: string; onInput?: (value: string) => void }", desc: "Optional top-bar search box." },
      { name: "topbar", type: "Maybe<TemplateResult>", desc: "Extra top-bar content; used in place of search when no search is given." },
      { name: "content", type: "Maybe<TemplateResult>", desc: "Main content region." },
    ],
  },
  // ---- statCard ----
  {
    id: "c-statcard",
    name: "statCard",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A single KPI tile with a label, a value, and an optional toned delta.",
    importLine: `import { statCard } from "@dxjs/ui";`,
    usageCode: `statCard({ label: "MRR", value: "$21.4k", delta: "+8%", tone: "pos" });`,
    demo: () =>
      html`<div class="gl-row">
        ${statCard({ label: "MRR", value: "$21.4k", delta: "+8%", tone: "pos" })}
        ${statCard({ label: "Churn", value: "2.1%", delta: "-0.3%", tone: "neg" })}
      </div>`,
    populateCode: `const online = signal("128");
statCard({
  label: "Devices online",
  value: online,
  delta: "+4",
  tone: "pos",
});`,
    populateNote: "value and delta may be reactive accessors; tone colours the delta.",
    props: [
      { name: "label", type: "string", desc: "The metric name." },
      { name: "value", type: "Maybe<string>", desc: "The metric value; a string or reactive accessor." },
      { name: "delta", type: "Maybe<string>", desc: "Optional change indicator (e.g. \"+8%\")." },
      { name: "tone", type: "Tone", desc: "Delta colour: pos | neg | warn | mut | info. Defaults to \"mut\"." },
    ],
  },
  // ---- statGrid ----
  {
    id: "c-statgrid",
    name: "statGrid",
    pkg: "@dxjs/ui",
    group: "UI · Controls",
    lead: "A responsive grid of KPI tiles, built from an array of statCard options.",
    importLine: `import { statGrid } from "@dxjs/ui";`,
    usageCode: `statGrid([
  { label: "MRR", value: "$21.4k", delta: "+8%", tone: "pos" },
  { label: "Accounts", value: "128", delta: "+4", tone: "pos" },
  { label: "Churn", value: "2.1%", delta: "-0.3%", tone: "neg" },
]);`,
    demo: () =>
      html`<div class="gl-stack">
        ${statGrid([
          { label: "MRR", value: "$21.4k", delta: "+8%", tone: "pos" },
          { label: "Accounts", value: "128", delta: "+4", tone: "pos" },
          { label: "Churn", value: "2.1%", delta: "-0.3%", tone: "neg" },
          { label: "Tickets", value: "12", tone: "mut" },
        ])}
      </div>`,
    populateCode: `// statGrid takes a plain array of StatCardOptions (positional, not an options object).
statGrid([
  { label: "Dispositivos", value: "128", delta: "+4", tone: "pos" },
  { label: "Offline", value: "3", tone: "warn" },
  { label: "Quarentena", value: "2", tone: "neg" },
]);`,
    populateNote: "The argument is a plain array of statCard options; the grid lays them out responsively.",
    props: [
      { name: "cards", type: "StatCardOptions[]", desc: "Array of stat-card options, each { label, value, delta?, tone? } (positional argument)." },
    ],
  },
  // ======================================================================
  // UI · Feedback
  // ======================================================================
  // ---- alert ----
  {
    id: "c-alert",
    name: "alert",
    pkg: "@dxjs/ui",
    group: "UI · Feedback",
    lead: "A banner for inline status or explanation, coloured by tone.",
    importLine: `import { alert } from "@dxjs/ui";`,
    usageCode: `alert({ tone: "info", title: "Heads up", body: "A new version is available." })`,
    demo: () =>
      html`<div class="gl-stack">
        ${alert({ tone: "info", title: "Heads up", body: "A new version is available." })}
        ${alert({ tone: "pos", title: "Deployed", body: "Build #482 is live.", onDismiss: () => {} })}
        ${alert({ tone: "warn", body: "You are near your storage quota." })}
        ${alert({ tone: "neg", title: "Failed", body: "Could not reach the API." })}
      </div>`,
    populateCode: `// tone drives the colour; onDismiss adds a close button
alert({
  tone: "pos",
  title: "Deployed",
  body: "Build #482 is live.",
  onDismiss: () => console.log("dismissed"),
});`,
    populateNote: "With no onDismiss the alert is non-dismissible; neg tone uses role=\"alert\".",
    props: [
      { name: "tone", type: `"pos" | "neg" | "warn" | "mut" | "info"`, desc: "Colour/semantics of the banner (default \"info\")." },
      { name: "title", type: "string", desc: "Optional bold heading line." },
      { name: "body", type: "Maybe<TemplateResult | string>", desc: "Main message content; may be reactive." },
      { name: "onDismiss", type: "() => void", desc: "If set, renders a × button that calls this." },
      { name: "icon", type: "TemplateResult | string", desc: "Optional leading glyph." },
    ],
  },
  // ---- modal ----
  {
    id: "c-modal",
    name: "modal",
    pkg: "@dxjs/ui",
    group: "UI · Feedback",
    lead: "A centred dialog over a backdrop, dismissed by Esc or backdrop click.",
    importLine: `import { modal } from "@dxjs/ui";`,
    usageCode: `const open = signal(false);
modal({
  open,
  title: "Edit account",
  body: "Change the account name and plan.",
  onClose: () => open.set(false),
});`,
    demo: () => {
      const open = signal(false);
      return html`<div class="gl-stack">
        ${button({ label: "Open modal", variant: "primary", onClick: () => open.set(true) })}
        ${modal({
          open,
          title: "Edit account",
          body: "Change the account name and plan.",
          footer: button({ label: "Close", variant: "primary", onClick: () => open.set(false) }),
          onClose: () => open.set(false),
        })}
      </div>`;
    },
    populateCode: `const open = signal(false);
// toggle open to show/hide; onClose runs on Esc, backdrop click or ×
modal({
  open,
  title: "Edit account",
  body: html\`<p>Change the account name and plan.</p>\`,
  footer: button({ label: "Save", variant: "primary", onClick: () => open.set(false) }),
  onClose: () => open.set(false),
  size: "md",
});`,
    populateNote: "open is a Maybe<boolean> — pass a signal so the dialog reacts; hidden while false.",
    props: [
      { name: "open", type: "Maybe<boolean>", desc: "Visibility; usually a signal." },
      { name: "title", type: "string", desc: "Optional heading used as the aria label." },
      { name: "body", type: "Maybe<TemplateResult | string>", desc: "Dialog content." },
      { name: "footer", type: "Maybe<TemplateResult>", desc: "Optional footer actions row." },
      { name: "onClose", type: "() => void", desc: "Called on Esc, backdrop click or ×." },
      { name: "size", type: `"sm" | "md" | "lg"`, desc: "Width tier of the dialog." },
    ],
  },
  // ---- tooltip ----
  {
    id: "c-tooltip",
    name: "tooltip",
    pkg: "@dxjs/ui",
    group: "UI · Feedback",
    lead: "A hover and focus tooltip revealed purely by CSS, with no inline styles.",
    importLine: `import { tooltip } from "@dxjs/ui";`,
    usageCode: `tooltip({ children: button({ label: "Hover me" }), tip: "I appear on hover & focus" })`,
    demo: () =>
      html`<div class="gl-row">
        ${tooltip({ children: button({ label: "Hover me" }), tip: "I appear on hover & focus", placement: "top" })}
        ${tooltip({ children: button({ label: "Right" }), tip: "Shown to the right", placement: "right" })}
      </div>`,
    populateCode: `// children is the element described; placement positions the tip
tooltip({
  children: button({ label: "Delete" }),
  tip: "Remove this item permanently",
  placement: "bottom",
});`,
    populateNote: "The tip is wired via aria-describedby; it reveals on both hover and keyboard focus.",
    props: [
      { name: "tip", type: "string", desc: "The tooltip text." },
      { name: "children", type: "TemplateResult | string", desc: "The element the tooltip describes." },
      { name: "placement", type: `"top" | "bottom" | "left" | "right"`, desc: "Side the tip appears on (default \"top\")." },
    ],
  },
  // ---- skeleton ----
  {
    id: "c-skeleton",
    name: "skeleton",
    pkg: "@dxjs/ui",
    group: "UI · Feedback",
    lead: "A shimmering placeholder for content that is still loading.",
    importLine: `import { skeleton } from "@dxjs/ui";`,
    usageCode: `skeleton({ kind: "line", lines: 3 })`,
    demo: () =>
      html`<div class="gl-stack">
        ${skeleton({ kind: "line", lines: 3 })}
        <div class="gl-row">${skeleton({ kind: "circle" })}${skeleton({ kind: "rect" })}</div>
      </div>`,
    populateCode: `// kind "line" repeats lines; "rect" and "circle" are single blocks
skeleton({ kind: "line", lines: 4 });
skeleton({ kind: "circle" });
skeleton({ kind: "rect" });`,
    populateNote: "lines only applies to kind=\"line\" (default 3); all variants are aria-hidden.",
    props: [
      { name: "kind", type: `"line" | "rect" | "circle"`, desc: "Shape of the placeholder (default \"line\")." },
      { name: "lines", type: "number", desc: "Number of lines when kind=\"line\" (default 3)." },
    ],
  },
  // ---- spinner ----
  {
    id: "c-spinner",
    name: "spinner",
    pkg: "@dxjs/ui",
    group: "UI · Feedback",
    lead: "A small indeterminate loading indicator with an accessible label.",
    importLine: `import { spinner } from "@dxjs/ui";`,
    usageCode: `spinner("Loading")`,
    demo: () =>
      html`<div class="gl-row">
        ${spinner("Loading")}
        ${spinner("Saving changes")}
      </div>`,
    populateCode: `// label is a positional string, exposed via aria-label (role="status")
spinner("Loading your workspace");`,
    populateNote: "The label argument is positional, not an options object; it defaults to \"Loading\".",
    props: [
      { name: "label", type: "string", desc: "Accessible label (positional arg, default \"Loading\")." },
    ],
  },
  // ---- progress ----
  {
    id: "c-progress",
    name: "progress",
    pkg: "@dxjs/ui",
    group: "UI · Feedback",
    lead: "A determinate progress bar built on the native <progress> element.",
    importLine: `import { progress } from "@dxjs/ui";`,
    usageCode: `progress({ value: 64, showValue: true, tone: "info" })`,
    demo: () => {
      const value = signal(64);
      return html`<div class="gl-stack">
        ${progress({ value, showValue: true, tone: "info" })}
        ${progress({ value: 32, tone: "pos" })}
      </div>`;
    },
    populateCode: `const value = signal(64);
// value may be reactive; showValue appends a percentage
progress({ value, max: 100, showValue: true, tone: "info" });`,
    populateNote: "The percentage shown is value/max rounded; value may be a signal for live updates.",
    props: [
      { name: "value", type: "Maybe<number>", desc: "Current value (0..max); may be reactive." },
      { name: "max", type: "number", desc: "Upper bound (default 100)." },
      { name: "showValue", type: "boolean", desc: "Append the numeric percentage after the bar." },
      { name: "tone", type: `"pos" | "neg" | "warn" | "mut" | "info"`, desc: "Colour of the filled bar." },
    ],
  },
  // ---- meter ----
  {
    id: "c-meter",
    name: "meter",
    pkg: "@dxjs/ui",
    group: "UI · Feedback",
    lead: "A thin inline usage meter whose fill width is a CSP-safe SVG attribute.",
    importLine: `import { meter } from "@dxjs/ui";`,
    usageCode: `meter({ value: 0.72, tone: "warn", label: "CPU" })`,
    demo: () => {
      const value = signal(0.72);
      return html`<div class="gl-stack">
        ${meter({ value, tone: "warn", label: "CPU" })}
        ${meter({ value: 0.35, tone: "pos", label: "Memory" })}
      </div>`;
    },
    populateCode: `const value = signal(0.72);
// value is a 0..1 fraction; fill width is an SVG rect attribute (no inline style)
meter({ value, tone: "warn", label: "CPU" });`,
    populateNote: "value is clamped to 0..1; the fill uses an SVG width attribute so it passes style-src.",
    props: [
      { name: "value", type: "Maybe<number>", desc: "Fill fraction from 0 to 1; may be reactive." },
      { name: "tone", type: `"pos" | "neg" | "warn" | "mut" | "info"`, desc: "Colour of the fill." },
      { name: "label", type: "string", desc: "Accessible label (aria-label on the progressbar)." },
    ],
  },
  // ---- topProgress ----
  {
    id: "c-topprogress",
    name: "topProgress",
    pkg: "@dxjs/ui",
    group: "UI · Feedback",
    lead: "A thin page-top progress bar for route changes, determinate or indeterminate.",
    importLine: `import { topProgress } from "@dxjs/ui";`,
    usageCode: `topProgress({ value: 0.4 })`,
    demo: () => {
      const value = signal(0.4);
      return html`<div class="gl-stack">
        ${topProgress({ value, tone: "info" })}
        ${topProgress({})}
      </div>`;
    },
    populateCode: `const value = signal(0.4);
// a 0..1 value is determinate; omit value for an indeterminate shimmer
topProgress({ value, tone: "info" });
topProgress({ done: true }); // hidden when navigation finishes`,
    populateNote: "With no value the bar shows an indeterminate shimmer; done hides it.",
    props: [
      { name: "value", type: "Maybe<number | undefined>", desc: "0..1 fraction; omit for indeterminate." },
      { name: "tone", type: `"pos" | "neg" | "warn" | "mut" | "info"`, desc: "Colour of the bar." },
      { name: "done", type: "Maybe<boolean>", desc: "Hide the bar when true (navigation finished)." },
    ],
  },
  // ---- emptyState ----
  {
    id: "c-emptystate",
    name: "emptyState",
    pkg: "@dxjs/ui",
    group: "UI · Feedback",
    lead: "A placeholder shown when a list or view has no content, with an optional action.",
    importLine: `import { emptyState } from "@dxjs/ui";`,
    usageCode: `emptyState({ title: "No results", description: "Try a different filter.", action: { label: "Reset", onClick: () => {} } })`,
    demo: () =>
      html`<div class="gl-stack">
        ${emptyState({
          title: "No results",
          description: "Try a different filter.",
          action: { label: "Reset", onClick: () => {} },
        })}
      </div>`,
    populateCode: `// action renders a primary button that calls onClick
emptyState({
  title: "No results",
  description: "Try a different filter.",
  action: { label: "Reset", onClick: () => clearFilters() },
});`,
    populateNote: "action is optional; omit it for a message-only empty state.",
    props: [
      { name: "title", type: "string", desc: "Headline of the empty state." },
      { name: "description", type: "string", desc: "Optional supporting line." },
      { name: "icon", type: "TemplateResult | string", desc: "Optional illustrative glyph." },
      { name: "action", type: "{ label: string; onClick: () => void }", desc: "Optional primary call-to-action button." },
    ],
  },
  // ======================================================================
  // UI · Navigation
  // ======================================================================
  // ---- tabs ----
  {
    id: "c-tabs",
    name: "tabs",
    pkg: "@dxjs/ui",
    group: "UI · Navigation",
    lead: "An underline tab bar (role=tablist) whose active tab reads reactively.",
    importLine: `import { tabs } from "@dxjs/ui";`,
    usageCode: `tabs({
  tabs: [
    { id: "all", label: "All", count: 12 },
    { id: "open", label: "Open", count: 3 },
    { id: "closed", label: "Closed" },
  ],
  active: "all",
  onSelect: (id) => console.log(id),
});`,
    demo: () => {
      const active = signal("open");
      return tabs({
        tabs: [
          { id: "all", label: "All", count: 12 },
          { id: "open", label: "Open", count: 3 },
          { id: "closed", label: "Closed", disabled: true },
        ],
        active,
        onSelect: (id) => active.set(id),
        ariaLabel: "Issue states",
      });
    },
    populateCode: `// Drive the active tab from a signal so the bar stays in sync.
const active = signal("open");
tabs({ tabs, active, onSelect: (id) => active.set(id) });`,
    populateNote: "Both active and the per-tab count accept a reactive accessor, so updates re-render in place.",
    props: [
      { name: "tabs", type: "Maybe<TabItem[]>", desc: "Tab descriptors: id, label, optional count badge and disabled flag." },
      { name: "active", type: "Maybe<string>", desc: "The id of the selected tab; read reactively." },
      { name: "onSelect", type: "(id: string) => void", desc: "Called with the tab id when a tab is clicked." },
      { name: "ariaLabel", type: "string", desc: "Accessible name applied to the tablist." },
    ],
  },
  // ---- segmented ----
  {
    id: "c-segmented",
    name: "segmented",
    pkg: "@dxjs/ui",
    group: "UI · Navigation",
    lead: "A pill-group single-select control in the iOS style.",
    importLine: `import { segmented } from "@dxjs/ui";`,
    usageCode: `segmented({
  options: [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
  ],
  value: "week",
  onChange: (v) => console.log(v),
});`,
    demo: () => {
      const value = signal("week");
      return segmented({
        options: [
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ],
        value,
        onChange: (v) => value.set(v),
        size: "md",
        ariaLabel: "Range",
      });
    },
    populateCode: `// Hold the selection in a signal and update it on change.
const value = signal("week");
segmented({ options, value, onChange: (v) => value.set(v) });`,
    props: [
      { name: "options", type: "Maybe<{ value: string; label: string }[]>", desc: "The selectable segments." },
      { name: "value", type: "Maybe<string>", desc: "The value of the active segment; read reactively." },
      { name: "onChange", type: "(value: string) => void", desc: "Called with the chosen value." },
      { name: "size", type: `"sm" | "md"`, desc: "Control density (default \"sm\")." },
      { name: "ariaLabel", type: "string", desc: "Accessible name applied to the group." },
    ],
  },
  // ---- breadcrumb ----
  {
    id: "c-breadcrumb",
    name: "breadcrumb",
    pkg: "@dxjs/ui",
    group: "UI · Navigation",
    lead: "A breadcrumb trail where every crumb but the last may be an activating button.",
    importLine: `import { breadcrumb } from "@dxjs/ui";`,
    usageCode: `breadcrumb([
  { label: "Home", onClick: () => go("/") },
  { label: "Projects", onClick: () => go("/projects") },
  { label: "dxjs" },
]);`,
    demo: () => {
      const here = signal("dxjs");
      return breadcrumb([
        { label: "Home", onClick: () => here.set("Home") },
        { label: "Projects", onClick: () => here.set("Projects") },
        { label: "dxjs" },
      ]);
    },
    populateCode: `// breadcrumb takes a positional array of crumbs.
// A crumb with no onClick (or the last one) renders as current, not a button.
breadcrumb([{ label: "Home", onClick: go }, { label: "dxjs" }]);`,
    populateNote: "The argument is positional: pass the crumb array directly, not an options object.",
    props: [
      { name: "items", type: "Crumb[]", desc: "Positional array of crumbs, ordered root to current." },
      { name: "items[].label", type: "string", desc: "Visible text of the crumb." },
      { name: "items[].onClick", type: "() => void", desc: "Makes the crumb an activating button; omit for a plain label." },
    ],
  },
  // ---- navPanel ----
  {
    id: "c-navpanel",
    name: "navPanel",
    pkg: "@dxjs/ui",
    group: "UI · Navigation",
    lead: "A grouped side navigation panel with icons, labels and optional badges.",
    importLine: `import { navPanel } from "@dxjs/ui";`,
    usageCode: `navPanel({
  groups: [
    { label: "Main", items: [
      { id: "home", label: "Home", icon: icon("home", { size: 16 }), badge: 3 },
      { id: "inbox", label: "Inbox", icon: icon("bell", { size: 16 }) },
    ] },
  ],
  active: "home",
  onSelect: (id) => route(id),
});`,
    demo: () => {
      const active = signal("home");
      return navPanel({
        groups: [
          { label: "Main", items: [
            { id: "home", label: "Home", icon: icon("home", { size: 16 }), badge: 3 },
            { id: "inbox", label: "Inbox", icon: icon("bell", { size: 16 }) },
          ] },
          { label: "Admin", items: [
            { id: "users", label: "Users", icon: icon("users", { size: 16 }) },
            { id: "keys", label: "API keys", icon: icon("key", { size: 16 }) },
          ] },
        ],
        active,
        onSelect: (id) => active.set(id),
        ariaLabel: "Primary",
      });
    },
    populateCode: `// Keep the active id in a signal; groups and badges may be reactive.
const active = signal("home");
navPanel({ groups, active, onSelect: (id) => active.set(id) });`,
    props: [
      { name: "groups", type: "Maybe<PanelGroup[]>", desc: "Groups of items, each with an optional group label." },
      { name: "active", type: "Maybe<string>", desc: "The id of the active item; read reactively." },
      { name: "onSelect", type: "(id: string) => void", desc: "Called with the item id on click." },
      { name: "ariaLabel", type: "string", desc: "Accessible name for the nav (default \"Navigation\")." },
    ],
  },
  // ---- avatar ----
  {
    id: "c-avatar",
    name: "avatar",
    pkg: "@dxjs/ui",
    group: "UI · Navigation",
    lead: "A user avatar that renders a same-origin image, or initials when no image is given.",
    importLine: `import { avatar } from "@dxjs/ui";`,
    usageCode: `avatar({ initials: "JD", name: "Jane Doe", size: "md" });`,
    demo: () => html`<div class="gl-row">${
      avatar({ initials: "JD", name: "Jane Doe", size: "sm" })
    }${
      avatar({ initials: "AR", name: "Ana Rosa", size: "md" })
    }${
      avatar({ initials: "WX", size: "lg" })
    }</div>`,
    populateCode: `// With a src it renders an <img> (CSP img-src 'self'); otherwise the initials.
avatar({ src: "/u/jane.png", name: "Jane Doe", size: "lg" });`,
    populateNote: "name becomes the image alt text or the accessible label of the initials badge.",
    props: [
      { name: "initials", type: "string", desc: "Fallback initials shown when no src is set (default \"?\")." },
      { name: "src", type: "string", desc: "Same-origin image URL; when present an <img> is rendered." },
      { name: "name", type: "string", desc: "Accessible name (img alt or aria-label)." },
      { name: "size", type: `"sm" | "md" | "lg"`, desc: "Avatar size (default \"md\")." },
    ],
  },
  // ---- divider ----
  {
    id: "c-divider",
    name: "divider",
    pkg: "@dxjs/ui",
    group: "UI · Navigation",
    lead: "A horizontal separator, optionally carrying a centred label.",
    importLine: `import { divider } from "@dxjs/ui";`,
    usageCode: `divider();          // a plain rule
divider("Section"); // a labelled separator`,
    demo: () => html`<div class="gl-stack"><span>Above</span>${
      divider("Section")
    }<span>Below</span>${
      divider()
    }<span>End</span></div>`,
    populateCode: `// divider takes an optional positional label; omit it for a bare rule.
divider("Danger zone");`,
    populateNote: "The label is a positional argument, not an options object.",
    props: [
      { name: "label", type: "string", desc: "Optional centred label; when omitted an <hr> rule is rendered." },
    ],
  },
  // ---- stack ----
  {
    id: "c-stack",
    name: "stack",
    pkg: "@dxjs/ui",
    group: "UI · Navigation",
    lead: "A flex container, vertical by default, with gap, alignment and wrapping controls.",
    importLine: `import { stack } from "@dxjs/ui";`,
    usageCode: `stack({
  direction: "row",
  gap: 2,
  justify: "between",
  align: "center",
  children: [left, right],
});`,
    demo: () => stack({
      direction: "row",
      gap: 2,
      justify: "between",
      align: "center",
      children: [
        html`<span class="gl-chip">one</span>`,
        html`<span class="gl-chip">two</span>`,
        html`<span class="gl-chip">three</span>`,
      ],
    }),
    populateCode: `// Vertical by default; gap maps to a --dx-space-* token (tier or 1-6).
stack({ gap: 3, align: "stretch", children: rows });`,
    props: [
      { name: "children", type: "TemplateResult[] | TemplateResult", desc: "The stacked content." },
      { name: "direction", type: `"row" | "col"`, desc: "Main axis (default \"col\")." },
      { name: "gap", type: "Size", desc: "Space between children; a tier (xs..xxl) or 1-6." },
      { name: "align", type: "StackAlign", desc: "align-items: start, center, end, stretch or baseline." },
      { name: "justify", type: "StackJustify", desc: "justify-content: start, center, end, between, around or evenly." },
      { name: "wrap", type: "boolean", desc: "Allow children to wrap onto multiple lines." },
    ],
  },
  // ---- grid ----
  {
    id: "c-grid",
    name: "grid",
    pkg: "@dxjs/ui",
    group: "UI · Navigation",
    lead: "A CSS grid with a fixed column count, or a responsive auto-fit grid when minCol is set.",
    importLine: `import { grid } from "@dxjs/ui";`,
    usageCode: `grid({ cols: 3, gap: 2, children: cards });`,
    demo: () => grid({
      cols: 3,
      gap: 2,
      children: [
        html`<span class="gl-chip">A</span>`,
        html`<span class="gl-chip">B</span>`,
        html`<span class="gl-chip">C</span>`,
        html`<span class="gl-chip">D</span>`,
        html`<span class="gl-chip">E</span>`,
        html`<span class="gl-chip">F</span>`,
      ],
    }),
    populateCode: `// Set minCol for a responsive auto-fit grid: repeat(auto-fit, minmax(minCol, 1fr)).
grid({ minCol: 220, gap: 3, children: cards });`,
    populateNote: "minCol takes precedence over cols and switches the grid to auto-fit mode.",
    props: [
      { name: "children", type: "TemplateResult[] | TemplateResult", desc: "The grid cells." },
      { name: "cols", type: "number", desc: "Fixed column count (default 2); ignored when minCol is set." },
      { name: "gap", type: "Size", desc: "Space between cells; a tier (xs..xxl) or 1-6." },
      { name: "minCol", type: "number", desc: "Minimum column width in px; enables a responsive auto-fit grid." },
    ],
  },
  // ---- space ----
  {
    id: "c-space",
    name: "space",
    pkg: "@dxjs/ui",
    group: "UI · Navigation",
    lead: "A fixed-size spacer, useful to separate inline or stacked items.",
    importLine: `import { space } from "@dxjs/ui";`,
    usageCode: `html\`<span>Left</span>\${space("xl")}<span>Right</span>\`;`,
    demo: () => html`<div class="gl-row"><span>Left</span>${
      space("xl")
    }<span>Right</span></div>`,
    populateCode: `// size is a positional Size: a tier (xs..xxl) or 1-6; defaults to "md".
space(4);`,
    populateNote: "The size is a positional argument, not an options object.",
    props: [
      { name: "size", type: "Size", desc: "Spacer size; a tier (xs..xxl) or the numeric alias 1-6 (default \"md\")." },
    ],
  },
  // ---- splitter ----
  {
    id: "c-splitter",
    name: "splitter",
    pkg: "@dxjs/ui",
    group: "UI · Navigation",
    lead: "Two resizable panes joined by a draggable, keyboard-operable divider.",
    importLine: `import { splitter } from "@dxjs/ui";`,
    usageCode: `splitter({
  start: leftPane,
  end: rightPane,
  initial: 0.45,
  min: 80,
});`,
    demo: () => splitter({
      start: html`<div class="gl-pane">Left pane</div>`,
      end: html`<div class="gl-pane">Right pane</div>`,
      direction: "horizontal",
      initial: 0.45,
      min: 80,
    }),
    populateCode: `// Drag the handle, or focus it and use Arrow keys (Home/End snap to the edges).
// direction: "vertical" stacks the panes top/bottom.
splitter({ start, end, direction: "vertical", initial: 0.5, min: 64 });`,
    populateNote: "The ratio lives in an internal signal and rides a CSS custom property — no inline styles, no document listeners.",
    props: [
      { name: "start", type: "TemplateResult", desc: "Content of the first pane." },
      { name: "end", type: "TemplateResult", desc: "Content of the second pane." },
      { name: "direction", type: `"horizontal" | "vertical"`, desc: "Pane arrangement (default \"horizontal\")." },
      { name: "initial", type: "number", desc: "Initial split ratio 0..1 (default 0.5)." },
      { name: "min", type: "number", desc: "Minimum size of each pane in px; clamps the ratio while dragging." },
    ],
  },
  // ======================================================================
  // UI · Overlays
  // ======================================================================
  // ---- drawer ----
  {
    id: "c-drawer",
    name: "drawer",
    pkg: "@dxjs/ui",
    group: "UI · Overlays",
    lead: "A slide-in panel over a backdrop, driven by an open accessor and closed on Escape, backdrop click, or the header close button.",
    importLine: 'import { drawer } from "@dxjs/ui";',
    usageCode: `const open = signal(false);
drawer({
  open: () => open(),
  side: "right",
  size: "md",
  title: "Details",
  body: "Everything about this record.",
  footer: button({ label: "Close", onClick: () => open.set(false) }),
  onClose: () => open.set(false),
});`,
    demo: () => {
      const open = signal(false);
      return html`<div class="gl-stack">
        ${button({ label: "Open drawer", variant: "primary", onClick: () => open.set(true) })}
        ${drawer({
          open: () => open(),
          side: "right",
          title: "Details",
          body: "A slide-in panel. Press Escape or click the backdrop to close.",
          footer: button({ label: "Close", onClick: () => open.set(false) }),
          onClose: () => open.set(false),
        })}
      </div>`;
    },
    populateCode: `// The panel body accepts a TemplateResult, so you can nest any content:
drawer({
  open: () => open(),
  side: "left",
  size: "lg",
  title: "Filters",
  body: html\`<div>\${field({ label: "Search" })}</div>\`,
  onClose: () => open.set(false),
});`,
    populateNote: "open is a Maybe<boolean> — pass a signal accessor to control visibility reactively.",
    props: [
      { name: "open", type: "Maybe<boolean>", desc: "Reactive visibility; hidden when false." },
      { name: "side", type: '"left" | "right" | "top" | "bottom"', desc: "Edge the panel slides from (default right)." },
      { name: "size", type: '"sm" | "md" | "lg"', desc: "Panel size tier (default md)." },
      { name: "title / body", type: "string / Maybe<TemplateResult | string>", desc: "Header title · panel contents." },
      { name: "footer", type: "Maybe<TemplateResult>", desc: "Optional footer region." },
      { name: "onClose", type: "() => void", desc: "Run on Escape, backdrop click, or close button." },
    ],
  },
  // ---- dropdown ----
  {
    id: "c-dropdown",
    name: "dropdown",
    pkg: "@dxjs/ui",
    group: "UI · Overlays",
    lead: "A button that opens a keyboard-navigable menu of actions, closing on select, Escape, or focus leaving the root.",
    importLine: 'import { dropdown } from "@dxjs/ui";',
    usageCode: `dropdown({
  label: "Actions",
  align: "start",
  items: [
    { label: "Edit", icon: icon("sliders", { size: 15 }), onSelect: edit },
    { label: "Duplicate", icon: icon("plus", { size: 15 }), onSelect: duplicate },
    { label: "Delete", danger: true, separator: true, onSelect: remove },
  ],
});`,
    demo: () => dropdown({
      label: "Actions",
      items: [
        { label: "Edit", onSelect: () => {} },
        { label: "Duplicate", onSelect: () => {} },
        { label: "Delete", danger: true, separator: true, onSelect: () => {} },
      ],
    }),
    populateCode: `// Items map one-to-one from your domain actions:
dropdown({
  label: "Export",
  align: "end",
  items: formats.map((f) => ({ label: f.name, onSelect: () => exportAs(f.id) })),
});`,
    props: [
      { name: "label", type: "Maybe<string | TemplateResult>", desc: "Trigger button content." },
      { name: "items", type: "Maybe<MenuItem[]>", desc: "Actions: label, onSelect, icon, disabled, danger, separator." },
      { name: "align", type: '"start" | "end"', desc: "Align the menu to the trigger's start (default) or end edge." },
      { name: "ariaLabel", type: "string", desc: "Accessible name for the trigger." },
    ],
  },
  // ---- accordion ----
  {
    id: "c-accordion",
    name: "accordion",
    pkg: "@dxjs/ui",
    group: "UI · Overlays",
    lead: "A set of collapsible sections with self-contained open-state, single-open by default or multi-open, reporting open ids via onToggle.",
    importLine: 'import { accordion } from "@dxjs/ui";',
    usageCode: `accordion({
  multiple: false,
  defaultOpen: ["a"],
  items: [
    { id: "a", title: "What is dxjs?", body: "A lean, reactive UI engine." },
    { id: "b", title: "Is it CSP-safe?", body: "Yes — no eval, no inline styles." },
  ],
  onToggle: (openIds) => console.log(openIds),
});`,
    demo: () => accordion({
      items: [
        { id: "a", title: "What is dxjs?", body: "A lean, secure, fine-grained reactive UI engine." },
        { id: "b", title: "Is it CSP-safe?", body: "Yes — no eval, no inline styles, escaped output." },
        { id: "c", title: "Does it tree-shake?", body: "Yes — sideEffects:false, per-component imports." },
      ],
      defaultOpen: ["a"],
    }),
    populateCode: `// Allow several panels open at once:
accordion({
  multiple: true,
  items: faqs.map((q) => ({ id: q.slug, title: q.question, body: q.answer })),
});`,
    props: [
      { name: "items", type: "Maybe<AccordionItem[]>", desc: "Sections: id, title, body, disabled." },
      { name: "multiple", type: "boolean", desc: "Allow several panels open at once (default false)." },
      { name: "defaultOpen", type: "string[]", desc: "Ids open on first render." },
      { name: "onToggle", type: "(openIds: string[]) => void", desc: "Open ids after each change." },
    ],
  },
  // ---- stepper ----
  {
    id: "c-stepper",
    name: "stepper",
    pkg: "@dxjs/ui",
    group: "UI · Overlays",
    lead: "A numbered step indicator (wizard): steps before the active one are done, the active one is current, the rest upcoming.",
    importLine: 'import { stepper } from "@dxjs/ui";',
    usageCode: `const active = signal("s2");
stepper({
  steps: [
    { id: "s1", label: "Account" },
    { id: "s2", label: "Profile", description: "Your info" },
    { id: "s3", label: "Done" },
  ],
  active: () => active(),
  onStep: (id) => active.set(id),
});`,
    demo: () => {
      const active = signal("s2");
      return stepper({
        steps: [
          { id: "s1", label: "Account" },
          { id: "s2", label: "Profile", description: "Your info" },
          { id: "s3", label: "Done" },
        ],
        active: () => active(),
        onStep: (id) => active.set(id),
      });
    },
    populateCode: `// Omit onStep to make the steps non-interactive; active may be an index:
stepper({ steps, active: 1, orientation: "vertical" });`,
    populateNote: "active is a Maybe<string | number> — an id or a 0-based index.",
    props: [
      { name: "steps", type: "Maybe<Step[]>", desc: "Steps: id, label, optional description." },
      { name: "active", type: "Maybe<string | number>", desc: "Active step: an id or a 0-based index." },
      { name: "onStep", type: "(id, index) => void", desc: "Click handler; omit for non-interactive." },
      { name: "orientation", type: '"horizontal" | "vertical"', desc: "Layout direction (default horizontal)." },
    ],
  },
  // ---- timeline ----
  {
    id: "c-timeline",
    name: "timeline",
    pkg: "@dxjs/ui",
    group: "UI · Overlays",
    lead: "A vertical timeline of events — each entry a tone-coloured dot on a rail with a title, optional time and body. Pure content, no state.",
    importLine: 'import { timeline } from "@dxjs/ui";',
    usageCode: `timeline([
  { title: "Created", time: "Nov 20", tone: "pos" },
  { title: "Built", time: "Nov 24", body: "Image pushed to registry." },
  { title: "Deployed", time: "Nov 27", tone: "info" },
]);`,
    demo: () => timeline([
      { title: "Created", time: "Nov 20", tone: "pos" },
      { title: "Built", time: "Nov 24", body: "Image pushed to registry." },
      { title: "Deployed", time: "Nov 27", tone: "info" },
    ]),
    populateCode: `// The items argument is a positional array (Maybe), so a signal works too:
timeline(() => events().map((e) => ({ title: e.name, time: e.at, tone: e.tone })));`,
    populateNote: "timeline takes its items as a single positional argument, not an options object.",
    props: [
      { name: "items", type: "Maybe<TimelineItem[]>", desc: "Positional array of entries." },
      { name: "title / time", type: "string / string", desc: "Entry heading · short meta line." },
      { name: "body", type: "Maybe<TemplateResult | string>", desc: "Optional entry detail." },
      { name: "tone", type: "Tone", desc: "Dot colour: pos · neg · warn · mut · info." },
      { name: "icon", type: "TemplateResult | string", desc: "Optional glyph inside the dot." },
    ],
  },
  // ---- popover ----
  {
    id: "c-popover",
    name: "popover",
    pkg: "@dxjs/ui",
    group: "UI · Overlays",
    lead: "A button-anchored floating panel (role=dialog) that opens on click and closes on a second click, Escape, or focus leaving the root.",
    importLine: 'import { popover } from "@dxjs/ui";',
    usageCode: `popover({
  trigger: button({ label: "Show details" }),
  content: "A small floating panel with details.",
  placement: "bottom",
  align: "start",
});`,
    demo: () => popover({
      trigger: button({ label: "Show popover" }),
      content: "A small floating panel with details.",
    }),
    populateCode: `// content accepts a TemplateResult for rich panels:
popover({
  trigger: button({ label: "Profile" }),
  placement: "right",
  content: html\`<div>\${descriptionList({ items: rows })}</div>\`,
});`,
    props: [
      { name: "trigger", type: "TemplateResult | string", desc: "Clickable anchor, wrapped in a toggle button." },
      { name: "content", type: "Maybe<TemplateResult | string>", desc: "Floating panel contents." },
      { name: "placement", type: '"top" | "bottom" | "left" | "right"', desc: "Side relative to the trigger (default bottom)." },
      { name: "align", type: '"start" | "end"', desc: "Cross-axis alignment (default start)." },
      { name: "ariaLabel", type: "string", desc: "Accessible name for the dialog." },
    ],
  },
  // ---- popconfirm ----
  {
    id: "c-popconfirm",
    name: "popconfirm",
    pkg: "@dxjs/ui",
    group: "UI · Overlays",
    lead: "A popover that asks for confirmation before a (usually destructive) action, with Cancel / Confirm buttons and an Escape-to-cancel bubble.",
    importLine: 'import { popconfirm } from "@dxjs/ui";',
    usageCode: `popconfirm({
  trigger: button({ label: "Delete", variant: "danger" }),
  title: "Delete item?",
  message: "This cannot be undone.",
  confirmLabel: "Delete",
  tone: "neg",
  onConfirm: () => remove(item),
});`,
    demo: () => popconfirm({
      trigger: button({ label: "Delete", variant: "danger" }),
      title: "Delete item?",
      message: "This cannot be undone.",
      onConfirm: () => {},
    }),
    populateCode: `// A non-destructive confirm — tone "pos" renders a primary confirm button:
popconfirm({
  trigger: button({ label: "Publish" }),
  title: "Publish now?",
  tone: "pos",
  confirmLabel: "Publish",
  onConfirm: () => publish(),
});`,
    props: [
      { name: "trigger", type: "TemplateResult | string", desc: "Clickable anchor for the bubble." },
      { name: "title / message", type: "string / string", desc: "Prompt heading · optional detail." },
      { name: "confirmLabel / cancelLabel", type: "string / string", desc: "Button text (default Confirm · Cancel)." },
      { name: "tone", type: "Tone", desc: "Confirm action tone (default neg → destructive)." },
      { name: "onConfirm / onCancel", type: "() => void", desc: "Confirm handler (required) · cancel handler." },
    ],
  },
  // ---- contextMenu ----
  {
    id: "c-contextmenu",
    name: "contextMenu",
    pkg: "@dxjs/ui",
    group: "UI · Overlays",
    lead: "Wraps a region with a right-click menu opened at the pointer, keyboard-navigable and closing on select, Escape, or focus leaving the root.",
    importLine: 'import { contextMenu } from "@dxjs/ui";',
    usageCode: `contextMenu({
  children: html\`<div>Right-click me</div>\`,
  items: [
    { label: "Copy", icon: "file-text", onSelect: copy },
    { label: "Refresh", icon: "refresh", onSelect: refresh },
    { label: "Delete", icon: "trash", danger: true, separator: true, onSelect: remove },
  ],
});`,
    demo: () => contextMenu({
      children: html`<div class="gl-ctx">Right-click me</div>`,
      items: [
        { label: "Copy", icon: "file-text", onSelect: () => {} },
        { label: "Refresh", icon: "refresh", onSelect: () => {} },
        { label: "Delete", icon: "trash", danger: true, separator: true, onSelect: () => {} },
      ],
    }),
    populateCode: `// Icons are IconName strings; map rows from the selected target:
contextMenu({
  children: fileRow,
  items: actionsFor(file).map((a) => ({ label: a.label, icon: a.icon, onSelect: a.run })),
});`,
    props: [
      { name: "children", type: "TemplateResult | string", desc: "Region that owns the right-click menu." },
      { name: "items", type: "ContextMenuItem[]", desc: "Rows: label, icon (IconName), onSelect, disabled, danger, separator." },
      { name: "ariaLabel", type: "string", desc: "Accessible name for the menu." },
    ],
  },
  // ---- pagination ----
  {
    id: "c-pagination",
    name: "pagination",
    pkg: "@dxjs/ui",
    group: "UI · Overlays",
    lead: "A standalone pager: prev/next, numbered buttons with ellipsis gaps, an optional range label and a rows-per-page select. Controlled via 0-based page + onPage.",
    importLine: 'import { pagination } from "@dxjs/ui";',
    usageCode: `const page = signal(0);
pagination({
  page: () => page(),
  total: 240,
  pageSize: 20,
  pageSizes: [10, 20, 50],
  labelRange: true,
  onPage: (p) => page.set(p),
  onPageSize: (n) => console.log(n),
});`,
    demo: () => {
      const page = signal(0);
      return pagination({
        page: () => page(),
        total: 240,
        pageSize: 20,
        pageSizes: [10, 20, 50],
        labelRange: true,
        onPage: (p) => page.set(p),
        onPageSize: () => {},
      });
    },
    populateCode: `// Or drive it by an explicit page count instead of total/pageSize:
pagination({ page: () => page(), pageCount: 12, siblingCount: 2, onPage: page.set });`,
    populateNote: "page and onPage are both 0-based; pageCount is derived from total/pageSize when omitted.",
    props: [
      { name: "page", type: "Maybe<number>", desc: "Current page, 0-based." },
      { name: "total / pageSize", type: "Maybe<number>", desc: "Derive pageCount and the range label." },
      { name: "pageCount", type: "Maybe<number>", desc: "Explicit page count (overrides total/pageSize)." },
      { name: "onPage", type: "(page: number) => void", desc: "Called with the next 0-based page." },
      { name: "pageSizes / onPageSize", type: "number[] / (size)=>void", desc: "Rows-per-page select choices · change handler." },
      { name: "siblingCount / labelRange", type: "number / boolean", desc: "Pages each side of current · show X–Y of Z label." },
    ],
  },
  // ======================================================================
  // UI · Pickers & data
  // ======================================================================
  // ---- datePicker ----
  {
    id: "c-datepicker",
    name: "datePicker",
    pkg: "@dxjs/ui",
    group: "UI · Pickers & data",
    lead: "A calendar date picker with a month grid, prev/next navigation and keyboard-reachable days, localisable via monthNames/weekdayNames.",
    importLine: 'import { datePicker } from "@dxjs/ui";',
    usageCode: `const date = signal("2026-11-27");
datePicker({
  value: () => date(),
  onChange: (iso) => date.set(iso),
  weekStart: 1,            // 0=Sun (default), 1=Mon
});`,
    demo: () => {
      const date = signal("2026-11-27");
      return html`<div class="gl-stack">
        ${datePicker({ value: () => date(), onChange: (iso) => date.set(iso), weekStart: 1 })}
        ${datePicker({ placeholder: "Pick a date", onChange: () => {} })}
      </div>`;
    },
    populateCode: `// The committed value is always an ISO "YYYY-MM-DD" string.
const date = signal("");               // empty ⇒ placeholder shown
datePicker({ value: () => date(), onChange: date.set });`,
    populateNote: "Controlled: feed a signal to value and store the ISO string on onChange.",
    props: [
      { name: "value", type: "Maybe<string>", desc: 'ISO "YYYY-MM-DD" or empty.' },
      { name: "onChange", type: "(iso) => void", desc: "Fires with the picked ISO date." },
      { name: "weekStart", type: "0 | 1", desc: "First weekday: 0=Sun (default), 1=Mon." },
      { name: "monthNames / weekdayNames", type: "string[]", desc: "Localised labels (default English)." },
      { name: "placeholder / size", type: "string / Size", desc: "Empty-face text · density." },
    ],
  },
  // ---- dateRangePicker ----
  {
    id: "c-daterange",
    name: "dateRangePicker",
    pkg: "@dxjs/ui",
    group: "UI · Pickers & data",
    lead: "An Odoo-style calendar range picker: click a start day, then an end day, with the span between the ends highlighted.",
    importLine: 'import { dateRangePicker } from "@dxjs/ui";',
    usageCode: `const start = signal("2026-11-03");
const end = signal("2026-11-14");
dateRangePicker({
  start: () => start(),
  end: () => end(),
  onChange: (s, e) => { start.set(s); end.set(e); },
});`,
    demo: () => {
      const start = signal("2026-11-03");
      const end = signal("2026-11-14");
      return html`<div class="gl-stack">
        ${dateRangePicker({ start: () => start(), end: () => end(), onChange: (s, e) => { start.set(s); end.set(e); }, weekStart: 1 })}
      </div>`;
    },
    populateCode: `// onChange emits (start, end); end is "" while only the start is chosen.
const start = signal("");
const end = signal("");
dateRangePicker({ start: () => start(), end: () => end(),
  onChange: (s, e) => { start.set(s); end.set(e); } });`,
    populateNote: "ISO strings compare chronologically, so the in-range test needs no Date math.",
    props: [
      { name: "start / end", type: "Maybe<string>", desc: 'ISO "YYYY-MM-DD" bounds or empty.' },
      { name: "onChange", type: "(start, end) => void", desc: 'Emits the range; end is "" mid-selection.' },
      { name: "weekStart", type: "0 | 1", desc: "First weekday: 0=Sun (default), 1=Mon." },
      { name: "monthNames / weekdayNames", type: "string[]", desc: "Localised labels (default English)." },
      { name: "placeholder / size", type: "string / Size", desc: "Empty-face text · density." },
    ],
  },
  // ---- timer ----
  {
    id: "c-timer",
    name: "timer",
    pkg: "@dxjs/ui",
    group: "UI · Pickers & data",
    lead: "A countdown or stopwatch with an mm:ss display; its interval is torn down on cleanup so it stops when the host unmounts.",
    importLine: 'import { timer } from "@dxjs/ui";',
    usageCode: `timer({ mode: "countdown", seconds: 90, onComplete: notify });
timer({ mode: "stopwatch" });
timer({ mode: "countdown", seconds: 30, controls: false });`,
    demo: () => html`<div class="gl-stack">
      ${timer({ mode: "countdown", seconds: 90, onComplete: () => {} })}
      ${timer({ mode: "stopwatch" })}
    </div>`,
    populateCode: `// Autostart and hide the controls for a read-only ticker:
timer({ mode: "countdown", seconds: 60, running: true, controls: false });`,
    populateNote: "No data to feed — timer is self-contained; just choose mode, seconds and whether to show controls.",
    props: [
      { name: "mode", type: '"countdown" | "stopwatch"', desc: "Count down from seconds, or up from 0." },
      { name: "seconds", type: "number", desc: "Countdown start in seconds (default 60)." },
      { name: "running", type: "boolean", desc: "Autostart on mount." },
      { name: "onComplete", type: "() => void", desc: "Fires when a countdown reaches zero." },
      { name: "controls", type: "boolean", desc: "Show start/pause/reset (default true)." },
    ],
  },
  // ---- slider ----
  {
    id: "c-slider",
    name: "slider",
    pkg: "@dxjs/ui",
    group: "UI · Pickers & data",
    lead: "A styled range input whose filled portion is drawn from a CSS custom property kept in sync by a reactive ref — no inline style.",
    importLine: 'import { slider } from "@dxjs/ui";',
    usageCode: `const volume = signal(40);
slider({
  value: () => volume(),
  min: 0, max: 100, step: 5,
  marks: [0, 25, 50, 75, 100],
  ariaLabel: "Volume",
  onInput: (v) => volume.set(v),
});`,
    demo: () => {
      const volume = signal(40);
      return html`<div class="gl-stack">
        ${slider({ value: () => volume(), min: 0, max: 100, step: 5, marks: [0, 25, 50, 75, 100], ariaLabel: "Volume", onInput: (v) => volume.set(v) })}
      </div>`;
    },
    populateCode: `// onInput fires on every drag tick; onChange only on release (commit).
const volume = signal(40);
slider({ value: () => volume(), onInput: volume.set, onChange: save });`,
    props: [
      { name: "value", type: "Maybe<number>", desc: "Current position." },
      { name: "min / max / step", type: "number", desc: "Range bounds and increment." },
      { name: "onInput / onChange", type: "(v) => void", desc: "Per-drag tick · committed on release." },
      { name: "marks", type: "number[]", desc: "Values rendered as labelled ticks." },
      { name: "disabled / size", type: "Maybe<boolean> / Size", desc: "Disable · density." },
    ],
  },
  // ---- numberInput ----
  {
    id: "c-numberinput",
    name: "numberInput",
    pkg: "@dxjs/ui",
    group: "UI · Pickers & data",
    lead: "A number field flanked by − and + buttons that step and clamp to [min, max]; each button disables at its bound.",
    importLine: 'import { numberInput } from "@dxjs/ui";',
    usageCode: `const qty = signal(3);
numberInput({
  value: () => qty(),
  min: 0, max: 10,
  ariaLabel: "Quantity",
  onChange: (v) => qty.set(v),
});`,
    demo: () => {
      const qty = signal(3);
      return html`<div class="gl-stack">
        ${numberInput({ value: () => qty(), min: 0, max: 10, ariaLabel: "Quantity", onChange: (v) => qty.set(v) })}
      </div>`;
    },
    populateCode: `// Typing a value clamps it on commit; step sizes the +/- buttons.
const qty = signal(1);
numberInput({ value: () => qty(), min: 1, max: 99, step: 1, onChange: qty.set });`,
    props: [
      { name: "value", type: "Maybe<number>", desc: "Current value." },
      { name: "min / max", type: "number", desc: "Clamp bounds; buttons disable at each." },
      { name: "step", type: "number", desc: "Amount each button adds/subtracts (default 1)." },
      { name: "onChange", type: "(v) => void", desc: "Fires on step or committed typing." },
      { name: "disabled / size", type: "Maybe<boolean> / Size", desc: "Disable · density." },
    ],
  },
  // ---- timePicker ----
  {
    id: "c-timepicker",
    name: "timePicker",
    pkg: "@dxjs/ui",
    group: "UI · Pickers & data",
    lead: 'A time-of-day picker: a face button opens a listbox of HH:MM slots; the committed value is always a 24h "HH:MM" string.',
    importLine: 'import { timePicker } from "@dxjs/ui";',
    usageCode: `const time = signal("09:30");
timePicker({
  value: () => time(),
  onChange: (v) => time.set(v),
  step: 30,          // slot granularity in minutes
  hour12: false,
});`,
    demo: () => {
      const time = signal("09:30");
      return html`<div class="gl-stack">
        ${timePicker({ value: () => time(), onChange: (v) => time.set(v), step: 30, hour12: false })}
      </div>`;
    },
    populateCode: `// hour12 only changes the display; the stored value stays 24h "HH:MM".
const time = signal("");
timePicker({ value: () => time(), onChange: time.set, step: 15, hour12: true });`,
    props: [
      { name: "value", type: "Maybe<string>", desc: 'Selected time as 24h "HH:MM".' },
      { name: "onChange", type: "(value) => void", desc: 'Fires with the chosen 24h "HH:MM".' },
      { name: "step", type: "number", desc: "Slot granularity in minutes (default 15)." },
      { name: "hour12", type: "boolean", desc: "Display am/pm (value stays 24h)." },
      { name: "disabled / size / placeholder", type: "—", desc: "Disable · density · empty-face text." },
    ],
  },
  // ---- exportMenu ----
  {
    id: "c-exportmenu",
    name: "exportMenu",
    pkg: "@dxjs/ui",
    group: "UI · Pickers & data",
    lead: "A dropdown button that exports the current rows to CSV, .xls or real .xlsx — pass columns plus a rows accessor over the live view.",
    importLine: 'import { exportMenu } from "@dxjs/ui";',
    usageCode: `exportMenu<Account>({
  rows: () => accounts(),          // accessor ⇒ reflects the filtered view
  columns: [
    { key: "name", label: "Name" },
    { key: "mrr", label: "MRR" },
  ],
  filename: "accounts",
  formats: ["csv", "xlsx"],
});`,
    demo: () => {
      const rows: Array<{ id: string; company: string; mrr: number }> = [
        { id: "1", company: "Acme", mrr: 490 },
        { id: "2", company: "Globex", mrr: 120 },
        { id: "3", company: "Initech", mrr: 1450 },
      ];
      return html`<div class="gl-row">
        ${exportMenu<{ id: string; company: string; mrr: number }>({
          rows: () => rows,
          columns: [{ key: "company", label: "Company" }, { key: "mrr", label: "MRR" }],
          filename: "accounts",
        })}
      </div>`;
    },
    populateCode: `// rows is an accessor, so the menu always exports what is on screen now.
exportMenu<Account>({
  rows: () => sortedRows(),
  columns: [{ key: "name", label: "Name" }, { key: "mrr", label: "MRR", value: (r) => r.mrr }],
  formats: ["csv", "xls", "xlsx"],   // default: all three
});`,
    populateNote: "Generic over the row type T; a column value function overrides the default row[key] lookup.",
    props: [
      { name: "rows", type: "() => T[]", desc: "Accessor for the rows to export." },
      { name: "columns", type: "ExportColumn<T>[]", desc: "{ key, label, value?(row) } per column." },
      { name: "filename", type: "string", desc: 'Base name (default "export").' },
      { name: "formats", type: '("csv"|"xls"|"xlsx")[]', desc: "Formats offered (default all three)." },
      { name: "label", type: "string", desc: 'Button text (default "Export").' },
    ],
  },
  // ---- virtualList ----
  {
    id: "c-virtuallist",
    name: "virtualList",
    pkg: "@dxjs/ui",
    group: "UI · Pickers & data",
    lead: "List virtualization: renders only the rows in and near the viewport, so a 100k-row list keeps a handful of DOM nodes (fixed row height).",
    importLine: 'import { virtualList } from "@dxjs/ui";',
    usageCode: `virtualList<{ id: number; name: string }>({
  rows: items,                 // Maybe<T[]>
  rowHeight: 32,
  height: 240,                 // viewport (scroll window) in px
  key: (r) => r.id,
  render: (r) => html\`<div class="gx-vrow">\${r.name}</div>\`,
});`,
    demo: () => html`<div class="gl-stack">
      ${virtualList<{ id: number; name: string }>({
        rows: Array.from({ length: 10000 }, (_, i) => ({ id: i, name: `Row ${i + 1}` })),
        rowHeight: 32,
        height: 240,
        key: (r) => r.id,
        render: (r) => html`<div class="gx-vrow">${r.name}</div>`,
      })}
    </div>`,
    populateCode: `// Bound the viewport with height; the sizer fakes the full scroll range.
virtualList<Row>({
  rows: () => data(),
  rowHeight: 32,
  height: 400,
  overscan: 6,                 // extra rows above/below (default 4)
  key: (r) => r.id,
  render: (r) => html\`<div class="gx-vrow">\${r.name}</div>\`,
});`,
    populateNote: "Use in component context — its onMount wires the scroll listener. Give it bounded height via the height option, not inline CSS.",
    props: [
      { name: "rows", type: "Maybe<T[]>", desc: "The full dataset (only a window renders)." },
      { name: "rowHeight", type: "number", desc: "Fixed row height in px." },
      { name: "height", type: "number", desc: "Viewport (scroll window) height in px." },
      { name: "key", type: "(row, i) => string | number", desc: "Stable row identity." },
      { name: "render", type: "(row, i) => TemplateResult", desc: "Row body." },
      { name: "overscan", type: "number", desc: "Extra rows above/below (default 4)." },
    ],
  },
  // ---- sparkline ----
  {
    id: "c-sparkline",
    name: "sparkline",
    pkg: "@dxjs/ui",
    group: "UI · Pickers & data",
    lead: "A tiny inline trend chart as pure SVG — a reactive polyline for inline KPI trends; for full charts use @dxjs/charts.",
    importLine: 'import { sparkline } from "@dxjs/ui";',
    usageCode: `sparkline({ data: [3, 5, 2, 8, 6, 9, 7], tone: "pos", fill: true, dot: true });
sparkline({ data: () => series(), tone: "neg" });`,
    demo: () => html`<div class="gl-row">
      ${sparkline({ data: [3, 5, 2, 8, 6, 9, 7], tone: "pos", fill: true, dot: true })}
      ${sparkline({ data: [9, 6, 7, 4, 5, 2, 3], tone: "neg" })}
    </div>`,
    populateCode: `// Pass an accessor and the line redraws when the data signal changes.
const series = signal([3, 5, 2, 8, 6]);
sparkline({ data: () => series(), width: 120, height: 32, tone: "info", fill: true });`,
    props: [
      { name: "data", type: "Maybe<number[]>", desc: "The series to plot." },
      { name: "width / height", type: "number", desc: "SVG viewBox (default 100 × 28)." },
      { name: "tone", type: "Tone", desc: "pos · neg · warn · mut · info." },
      { name: "fill", type: "boolean", desc: "Soft area fill under the line." },
      { name: "dot", type: "boolean", desc: "Mark the last point." },
    ],
  },
  // ---- metric ----
  {
    id: "c-metric",
    name: "metric",
    pkg: "@dxjs/ui",
    group: "UI · Pickers & data",
    lead: "A rich KPI tile: a value with a tone-arrowed delta, an optional inline sparkline trend, an icon, a hint and an optional clickable shell.",
    importLine: 'import { metric } from "@dxjs/ui";',
    usageCode: `metric({
  label: "Revenue",
  value: "$48.2k",
  delta: "+12%",
  tone: "pos",                 // pos ⇒ ▲, neg ⇒ ▼
  trend: [10, 14, 12, 18, 22],
  hint: "vs mês anterior",
});`,
    demo: () => html`<div class="gl-row">
      ${metric({ label: "Revenue", value: "$48.2k", delta: "+12%", tone: "pos", trend: [10, 14, 12, 18, 22], hint: "vs mês anterior" })}
      ${metric({ label: "Error rate", value: "0.4%", delta: "-0.1%", tone: "neg", trend: [5, 4, 4, 3, 2] })}
    </div>`,
    populateCode: `// value, delta and trend accept accessors, so a tile stays live:
const revenue = signal("$48.2k");
metric({ label: "Revenue", value: () => revenue(), delta: () => delta(), tone: "pos",
  onClick: openDetails });     // onClick ⇒ the tile becomes a <button>`,
    props: [
      { name: "label / value", type: "string / Maybe<string|number>", desc: "Caption and figure." },
      { name: "delta", type: "Maybe<string>", desc: 'Change indicator, e.g. "+12%".' },
      { name: "tone", type: "Tone", desc: "Colours the delta/trend; derives the arrow." },
      { name: "trend", type: "Maybe<number[]>", desc: "Series ⇒ inline sparkline on the right." },
      { name: "icon / hint", type: "TemplateResult|string / string", desc: "Leading glyph · sub-caption." },
      { name: "onClick / size", type: "() => void / Size", desc: "Clickable shell · density." },
    ],
  },
  // ======================================================================
  // UI · Media & mobile
  // ======================================================================
  // ---- image ----
  {
    id: "c-image",
    name: "image",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A responsive, lazy-loaded image in a <figure> that swaps in a placeholder class on load error.",
    importLine: 'import { image } from "@dxjs/ui";',
    usageCode: `image({
  src: posterUri,              // same-origin or data: URI (CSP img-src 'self' data:)
  alt: "January revenue chart",
  ratio: "16/9",               // aspect-ratio via a CSS var, never a style attr
  rounded: true,
  fit: "cover",
  caption: "Monthly revenue",
});`,
    demo: () => {
      const src =
        "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">' +
            '<rect width="320" height="180" fill="#6366f1"/>' +
            '<text x="160" y="98" font-family="sans-serif" font-size="20" fill="white" text-anchor="middle">16 / 9</text></svg>',
        );
      return image({ src, alt: "Sample gradient", ratio: "16/9", rounded: true, caption: "An inline data: SVG" });
    },
    populateCode: `// Keep the source same-origin or a data: URI so it passes img-src 'self' data:.
const posterUri =
  "data:image/svg+xml," +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">...</svg>');

image({ src: posterUri, alt: "Gradient", ratio: "4/3", fit: "contain", loading: "eager" });`,
    populateNote: "src must be same-origin or a data: URI; a broken load reveals a placeholder via a class, with no inline styles.",
    props: [
      { name: "src", type: "string", desc: "Same-origin or data: URI (CSP img-src 'self' data:)." },
      { name: "alt", type: "string", desc: "Alternative text for the image." },
      { name: "ratio", type: "string", desc: 'Aspect ratio, e.g. "16/9" or "1/1"; applied via a CSS var.' },
      { name: "fit", type: '"cover" | "contain"', desc: "How the image fills its box (default cover)." },
      { name: "rounded", type: "boolean", desc: "Round the figure corners." },
      { name: "caption", type: "string", desc: "Optional figcaption text." },
    ],
  },
  // ---- video ----
  {
    id: "c-video",
    name: "video",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A same-origin <video> in a <figure> with a poster and controls on by default.",
    importLine: 'import { video } from "@dxjs/ui";',
    usageCode: `video({
  src: "/media/intro.mp4",     // same-origin (CSP media-src 'self')
  poster: posterUri,
  controls: true,
  ratio: "16/9",
  caption: "Product intro",
});`,
    demo: () => {
      const poster =
        "data:image/svg+xml," +
        encodeURIComponent(
          '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">' +
            '<rect width="320" height="180" fill="#0ea5e9"/>' +
            '<text x="160" y="98" font-family="sans-serif" font-size="18" fill="white" text-anchor="middle">video poster</text></svg>',
        );
      return video({ src: "", poster, controls: true, ratio: "16/9", caption: "Poster shown; media blocked by CSP" });
    },
    populateCode: `// Media must be same-origin to pass media-src 'self'. The poster may be a data: URI.
video({ src: "/media/clip.mp4", poster: posterUri, muted: true, loop: true, autoplay: false });`,
    populateNote: "Under a strict CSP the actual media src must be same-origin; a data: poster always renders.",
    props: [
      { name: "src", type: "string", desc: "Same-origin video URL (CSP media-src 'self')." },
      { name: "poster", type: "string", desc: "Poster image shown before playback." },
      { name: "controls", type: "boolean", desc: "Show native controls (default true)." },
      { name: "muted", type: "boolean", desc: "Start muted." },
      { name: "loop", type: "boolean", desc: "Loop playback." },
      { name: "ratio", type: "string", desc: 'Aspect ratio, e.g. "16/9".' },
    ],
  },
  // ---- descriptionList ----
  {
    id: "c-desclist",
    name: "descriptionList",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A semantic key/value <dl> laid out on a responsive one-, two- or three-column grid.",
    importLine: 'import { descriptionList } from "@dxjs/ui";',
    usageCode: `descriptionList({
  columns: 2,
  layout: "inline",            // term beside value; "stacked" = term over value
  bordered: true,
  items: [
    { term: "Name", value: "Acme Angola" },
    { term: "Notes", value: "Renews in Q2 2027", span: true },
  ],
});`,
    demo: () =>
      descriptionList({
        columns: 2,
        bordered: true,
        items: [
          { term: "Name", value: "Acme Angola" },
          { term: "Plan", value: "Enterprise" },
          { term: "Seats", value: "120" },
          { term: "Notes", value: "Renews in Q2 2027", span: true },
        ],
      }),
    populateCode: `const items = [
  { term: "Status", value: "Active" },
  { term: "Region", value: "Luanda" },
  { term: "Owner", value: "Jane Doe" },
];
descriptionList({ items, columns: 3, layout: "stacked" });`,
    populateNote: "Each DescItem value may be plain text, a template, or a reactive accessor; set span to make a row fill every column.",
    props: [
      { name: "items", type: "Maybe<DescItem[]>", desc: "The term/value rows ({ term, value, span? })." },
      { name: "columns", type: "1 | 2 | 3", desc: "Columns on wide screens; collapses to 1 when narrow (default 1)." },
      { name: "layout", type: '"inline" | "stacked"', desc: "Term beside (default) or over the value." },
      { name: "bordered", type: "boolean", desc: "Draw separating rules between rows." },
    ],
  },
  // ---- tree ----
  {
    id: "c-tree",
    name: "tree",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A hierarchical, keyboard-navigable tree view where parents expand/collapse and leaves select.",
    importLine: 'import { tree } from "@dxjs/ui";',
    usageCode: `tree({
  nodes: fileTree,
  selected: sel,               // controlled selection id
  defaultExpanded: ["src"],
  onSelect: (id) => sel.set(id),
  onToggle: (id, open) => console.log(id, open),
});`,
    demo: () => {
      const sel = signal("src/index");
      return tree({
        nodes: [
          { id: "src", label: "src", icon: "folder", children: [
            { id: "src/index", label: "index.ts", icon: "file-text" },
            { id: "src/app", label: "app.ts", icon: "file-text" },
          ] },
          { id: "pkg", label: "package.json", icon: "file-text" },
        ],
        defaultExpanded: ["src"],
        selected: sel,
        onSelect: (id) => sel.set(id),
      });
    },
    populateCode: `const sel = signal("");
const nodes = [
  { id: "api", label: "api", icon: "folder", children: [
    { id: "api/users", label: "users.ts", icon: "file-text" },
  ] },
  { id: "readme", label: "README.md", icon: "file-text" },
];
tree({ nodes, selected: sel, onSelect: (id) => sel.set(id) });`,
    populateNote: "A TreeNode with a non-empty children array becomes a parent; selection is controlled, so own it in a signal.",
    props: [
      { name: "nodes", type: "Maybe<TreeNode[]>", desc: "The tree data ({ id, label, icon?, children?, disabled? })." },
      { name: "selected", type: "Maybe<string>", desc: "The controlled selected node id." },
      { name: "defaultExpanded", type: "string[]", desc: "Ids expanded on first render." },
      { name: "onSelect", type: "(id: string) => void", desc: "Fired when a node is activated." },
      { name: "onToggle", type: "(id: string, expanded: boolean) => void", desc: "Fired when a parent expands or collapses." },
    ],
  },
  // ---- kanban ----
  {
    id: "c-kanban",
    name: "kanban",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A controlled column board whose cards move by drag-and-drop or keyboard-reachable arrow buttons.",
    importLine: 'import { kanban } from "@dxjs/ui";',
    usageCode: `kanban({
  columns: board,              // reactive; the caller owns the state
  draggable: true,
  onMove: ({ card, from, to, index }) => applyMove(card, from, to, index),
});`,
    demo: () =>
      kanban({
        columns: [
          { id: "todo", title: "To Do", accent: "mut", cards: [
            { id: "c1", title: "Spec API", meta: "AR · Nov 30", tags: ["backend"] },
            { id: "c2", title: "Design modal", tags: ["ui"] },
          ] },
          { id: "doing", title: "Doing", accent: "info", cards: [
            { id: "c3", title: "Build gallery", meta: "JS", body: "Render every component" },
          ] },
          { id: "done", title: "Done", accent: "pos", cards: [{ id: "c4", title: "CSP gate" }] },
        ],
        onMove: () => {},
      }),
    populateCode: `const board = signal([
  { id: "todo", title: "To Do", cards: [{ id: "c1", title: "Spec API" }] },
  { id: "doing", title: "Doing", cards: [] },
]);
kanban({
  columns: board,
  onMove: ({ card, from, to, index }) => board.set(reorder(board(), card, from, to, index)),
});`,
    populateNote: "The component renders and reports moves via onMove; the caller mutates its own signal of columns to apply them.",
    props: [
      { name: "columns", type: "Maybe<KanbanColumn[]>", desc: "The board columns, each with { id, title, cards, accent? }." },
      { name: "onMove", type: "(move: KanbanMove) => void", desc: "Reports a move ({ card, from, to, index }); the caller reorders." },
      { name: "draggable", type: "boolean", desc: "Enable HTML5 drag-and-drop alongside the arrow buttons (default true)." },
      { name: "ariaLabel", type: "string", desc: "Accessible label for the board." },
    ],
  },
  // ---- taskPanel ----
  {
    id: "c-taskpanel",
    name: "taskPanel",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A side rail of tasks with a live count, completion checkboxes, priority badges and progress bars.",
    importLine: 'import { taskPanel } from "@dxjs/ui";',
    usageCode: `taskPanel({
  title: "Sprint 12",
  tasks: sprint,               // or groups: [...] for sectioned
  onToggle: (id, done) => markDone(id, done),
  onSelect: (id) => openTask(id),
  action: { label: "Add task", icon: "plus", onClick: addTask },
});`,
    demo: () =>
      taskPanel({
        title: "Sprint 12",
        tasks: [
          { id: "t1", title: "Wire up auth", assignee: "AR", due: "Nov 30", priority: "high", progress: 0.4 },
          { id: "t2", title: "Write docs", assignee: "JS", priority: "med", progress: 0.1 },
          { id: "t3", title: "Ship gallery", done: true },
        ],
        onToggle: () => {},
        onSelect: () => {},
        action: { label: "Add task", icon: "plus", onClick: () => {} },
      }),
    populateCode: `const tasks = signal([
  { id: "t1", title: "Review PR", priority: "high", progress: 0.6 },
  { id: "t2", title: "Deploy", done: true },
]);
taskPanel({ title: "Today", tasks, onToggle: (id, done) => toggle(id, done) });`,
    populateNote: "Pass a flat tasks list or grouped sections (groups takes precedence); the header count totals whichever was given.",
    props: [
      { name: "tasks", type: "Maybe<Task[]>", desc: "A flat list of tasks ({ id, title, done?, assignee?, due?, priority?, progress? })." },
      { name: "groups", type: "Maybe<TaskGroup[]>", desc: "Sectioned tasks; takes precedence over tasks." },
      { name: "onToggle", type: "(id: string, done: boolean) => void", desc: "Fired by a task's completion checkbox." },
      { name: "onSelect", type: "(id: string) => void", desc: "Fired when a task row is clicked." },
      { name: "action", type: "{ label; icon?; onClick }", desc: "Optional header action button." },
    ],
  },
  // ---- commandPalette ----
  {
    id: "c-commandpalette",
    name: "commandPalette",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A ⌘K modal that filters grouped commands by label/keywords and runs the active one on Enter.",
    importLine: 'import { commandPalette } from "@dxjs/ui";',
    usageCode: `commandPalette({
  open: paletteOpen,           // controlled by the caller
  onClose: () => paletteOpen.set(false),
  groups: commandGroups,
  placeholder: "Type a command or search…",
});`,
    demo: () => {
      const open = signal(false);
      return html`<div class="gl-stack">
        ${button({ label: "Open palette…", onClick: () => open.set(true) })}
        ${commandPalette({
          open,
          onClose: () => open.set(false),
          groups: [
            { heading: "Navigation", items: [
              { id: "home", label: "Go Home", icon: "home", shortcut: "G H", onRun: () => open.set(false) },
              { id: "search", label: "Search files", icon: "search", keywords: ["find"], onRun: () => open.set(false) },
            ] },
            { heading: "Actions", items: [
              { id: "new", label: "New account", icon: "plus", shortcut: "⌘N", onRun: () => open.set(false) },
              { id: "theme", label: "Toggle theme", icon: "moon", onRun: () => open.set(false) },
            ] },
          ],
        })}
      </div>`;
    },
    populateCode: `const paletteOpen = signal(false);
const commandGroups = [
  { heading: "Navigation", items: [
    { id: "home", label: "Go Home", icon: "home", shortcut: "G H", onRun: () => goHome() },
  ] },
];
commandPalette({ open: paletteOpen, onClose: () => paletteOpen.set(false), groups: commandGroups });`,
    populateNote: "Render it once (hidden until open), drive open from the caller, and clear it in onClose; each CommandItem supplies its own onRun.",
    props: [
      { name: "open", type: "Maybe<boolean>", desc: "Whether the palette is shown (controlled)." },
      { name: "onClose", type: "() => void", desc: "Called on Escape, a backdrop click, or after a command runs." },
      { name: "groups", type: "Maybe<CommandGroup[]>", desc: "Labelled clusters of commands ({ heading?, items })." },
      { name: "placeholder", type: "string", desc: "Search box placeholder text." },
      { name: "emptyText", type: "string", desc: "Shown when the query matches nothing." },
    ],
  },
  // ---- icon ----
  {
    id: "c-icon",
    name: "icon",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A CSP-safe stroke-icon from the built-in 24×24 set, sized in pixels and coloured by currentColor.",
    importLine: 'import { icon } from "@dxjs/ui";',
    usageCode: `icon("home");                      // decorative, aria-hidden by default
icon("search", { size: 18 });
icon("bell", { title: "Notifications" });   // accessible name -> role="img"`,
    demo: () => html`<div class="gl-row">
      ${icon("home", { size: 24 })}
      ${icon("search", { size: 24 })}
      ${icon("folder", { size: 24 })}
      ${icon("bell", { size: 24 })}
      ${icon("calendar", { size: 24 })}
      ${icon("shield", { size: 24 })}
    </div>`,
    populateCode: `import { icon, iconNames } from "@dxjs/ui";
// iconNames lists every available glyph (e.g. for a picker).
iconNames.map((n) => icon(n, { size: 20 }));`,
    populateNote: "Names come from the fixed IconName union (see iconNames); colour is currentColor, so set a CSS color on an ancestor.",
    props: [
      { name: "name", type: "IconName", desc: "The glyph to render (first argument); one of the built-in names." },
      { name: "size", type: "number", desc: "Pixel size for width and height (default 20)." },
      { name: "title", type: "string", desc: "Accessible name; omit for a decorative (aria-hidden) icon." },
      { name: "class", type: "string", desc: "Extra class appended to dx-icon." },
    ],
  },
  // ---- fileUpload ----
  {
    id: "c-fileupload",
    name: "fileUpload",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A drag-and-drop dropzone plus a controlled file list showing size, progress and status.",
    importLine: 'import { fileUpload } from "@dxjs/ui";',
    usageCode: `fileUpload({
  accept: "image/*,.pdf",
  multiple: true,
  maxSize: 5 * 1024 * 1024,
  hint: "PNG, JPG or PDF up to 5 MB",
  items: files,                // controlled list with progress/status
  onFiles: (picked) => startUpload(picked),
  onRemove: (id) => removeFile(id),
});`,
    demo: () =>
      fileUpload({
        hint: "PNG, JPG or PDF up to 5 MB",
        accept: "image/*,.pdf",
        multiple: true,
        items: [
          { id: "f1", name: "report.pdf", size: 1536000, status: "uploading", progress: 0.4 },
          { id: "f2", name: "logo.png", size: 24576, status: "done" },
          { id: "f3", name: "big.zip", size: 9999999, status: "error", error: "Too large" },
        ],
        onFiles: () => {},
        onRemove: () => {},
      }),
    populateCode: `const files = signal([]);
fileUpload({
  multiple: true,
  items: files,
  onFiles: (picked) => files.set([...files(), ...picked.map(toUploadItem)]),
  onRemove: (id) => files.set(files().filter((f) => f.id !== id)),
});`,
    populateNote: "The picker opens with no JavaScript (a hidden <input>); you own the items list and advance each file's status/progress.",
    props: [
      { name: "onFiles", type: "(files: File[]) => void", desc: "Called with dropped/picked files; the caller starts the upload." },
      { name: "items", type: "Maybe<UploadItem[]>", desc: "Controlled list shown with progress and status." },
      { name: "onRemove", type: "(id: string) => void", desc: "Called to remove a listed file." },
      { name: "accept", type: "string", desc: 'accept attribute, e.g. "image/*,.pdf".' },
      { name: "multiple", type: "boolean", desc: "Allow selecting more than one file." },
      { name: "maxSize", type: "number", desc: "Reject files larger than this many bytes before onFiles." },
    ],
  },
  // ---- bottomSheet ----
  {
    id: "c-bottomsheet",
    name: "bottomSheet",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A mobile panel that slides up from the bottom edge over a backdrop, closing on Escape or backdrop click.",
    importLine: 'import { bottomSheet } from "@dxjs/ui";',
    usageCode: `bottomSheet({
  open: sheetOpen,             // controlled
  onClose: () => sheetOpen.set(false),
  title: "Share file",
  body: "Choose where to send report.pdf.",
  footer: button({ label: "Done", variant: "primary", onClick: () => sheetOpen.set(false) }),
});`,
    demo: () => {
      const open = signal(false);
      return html`<div class="gl-stack">
        ${button({ label: "Open sheet…", onClick: () => open.set(true) })}
        ${bottomSheet({
          open,
          onClose: () => open.set(false),
          title: "Share file",
          body: "Choose where to send report.pdf.",
          footer: button({ label: "Done", variant: "primary", onClick: () => open.set(false) }),
        })}
      </div>`;
    },
    populateCode: `const sheetOpen = signal(false);
bottomSheet({
  open: sheetOpen,
  onClose: () => sheetOpen.set(false),
  title: "Details",
  body: html\`<p>Any template or accessor works as the body.</p>\`,
});`,
    populateNote: "The slide is a class-toggled CSS transform (no inline styles); drive open from a signal and clear it in onClose.",
    props: [
      { name: "open", type: "Maybe<boolean>", desc: "Whether the sheet is shown (controlled)." },
      { name: "onClose", type: "() => void", desc: "Called on Escape, a backdrop click, or the close button." },
      { name: "title", type: "string", desc: "Optional header title." },
      { name: "body", type: "Maybe<TemplateResult | string>", desc: "The sheet content." },
      { name: "footer", type: "Maybe<TemplateResult>", desc: "Optional footer content (e.g. action buttons)." },
    ],
  },
  // ---- actionSheet ----
  {
    id: "c-actionsheet",
    name: "actionSheet",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A bottom stack of large touch actions plus a cancel row, with menu/menuitem semantics.",
    importLine: 'import { actionSheet } from "@dxjs/ui";',
    usageCode: `actionSheet({
  open: sheetOpen,             // controlled
  onClose: () => sheetOpen.set(false),
  title: "report.pdf",
  actions: [
    { label: "Rename", icon: "sliders", onSelect: rename },
    { label: "Delete", icon: "trash", danger: true, onSelect: remove },
  ],
});`,
    demo: () => {
      const open = signal(false);
      return html`<div class="gl-stack">
        ${button({ label: "Open actions…", onClick: () => open.set(true) })}
        ${actionSheet({
          open,
          onClose: () => open.set(false),
          title: "report.pdf",
          actions: [
            { label: "Rename", icon: "sliders", onSelect: () => {} },
            { label: "Download", icon: "download", onSelect: () => {} },
            { label: "Delete", icon: "trash", danger: true, onSelect: () => {} },
          ],
        })}
      </div>`;
    },
    populateCode: `const sheetOpen = signal(false);
actionSheet({
  open: sheetOpen,
  onClose: () => sheetOpen.set(false),
  actions: [
    { label: "Share", icon: "upload", onSelect: () => share() },
    { label: "Archive", icon: "box", onSelect: () => archive() },
  ],
  cancelLabel: "Dismiss",
});`,
    populateNote: "Selecting an action fires its onSelect then closes; Escape, the backdrop and the cancel row all call onClose.",
    props: [
      { name: "open", type: "Maybe<boolean>", desc: "Whether the sheet is shown (controlled)." },
      { name: "onClose", type: "() => void", desc: "Called on Escape, a backdrop click, or the cancel row." },
      { name: "actions", type: "Maybe<SheetAction[]>", desc: "The action rows ({ label, icon?, onSelect?, danger?, disabled? })." },
      { name: "title", type: "string", desc: "Optional heading above the actions." },
      { name: "cancelLabel", type: "string", desc: 'Label for the cancel row (default "Cancel").' },
    ],
  },
  // ---- tabBar ----
  {
    id: "c-tabbar",
    name: "tabBar",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A fixed bottom navigation bar of icon-over-label tabs with an optional badge bubble.",
    importLine: 'import { tabBar } from "@dxjs/ui";',
    usageCode: `tabBar({
  items: navItems,
  active: current,             // id of the selected tab
  onSelect: (id) => current.set(id),
});`,
    demo: () => {
      const active = signal("home");
      return tabBar({
        items: [
          { id: "home", label: "Home", icon: "home" },
          { id: "files", label: "Files", icon: "folder", badge: 3 },
          { id: "people", label: "People", icon: "users" },
          { id: "me", label: "Me", icon: "shield" },
        ],
        active,
        onSelect: (id) => active.set(id),
      });
    },
    populateCode: `const current = signal("home");
const navItems = [
  { id: "home", label: "Home", icon: "home" },
  { id: "inbox", label: "Inbox", icon: "bell", badge: 12 },
];
tabBar({ items: navItems, active: current, onSelect: (id) => current.set(id) });`,
    populateNote: "Each TabBarItem needs an icon name; selection is controlled, so hold the active id in a signal and set it in onSelect.",
    props: [
      { name: "items", type: "Maybe<TabBarItem[]>", desc: "The tabs ({ id, label, icon, badge? })." },
      { name: "active", type: "Maybe<string>", desc: "Id of the selected tab." },
      { name: "onSelect", type: "(id: string) => void", desc: "Fired when a tab is tapped." },
      { name: "ariaLabel", type: "string", desc: "Accessible label for the tab bar." },
    ],
  },
  // ---- fab ----
  {
    id: "c-fab",
    name: "fab",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A floating action button that either fires onClick or toggles a vertical speed-dial of actions.",
    importLine: 'import { fab } from "@dxjs/ui";',
    usageCode: `fab({
  label: "Compose",            // required accessible name (icon-only)
  icon: "plus",
  position: "br",
  actions: [
    { label: "New mail", icon: "file-text", onClick: compose },
    { label: "Upload", icon: "upload", onClick: upload },
  ],
});`,
    demo: () =>
      fab({
        label: "Compose",
        icon: "plus",
        actions: [
          { label: "New mail", icon: "file-text", onClick: () => {} },
          { label: "Upload", icon: "upload", onClick: () => {} },
        ],
      }),
    populateCode: `// Without actions it is a plain button:
fab({ label: "Add", icon: "plus", onClick: () => addItem() });
// With actions, clicking toggles a speed-dial that closes on select/Escape/blur.
fab({ label: "Create", icon: "plus", tone: "pos", position: "bl", actions: dialActions });`,
    populateNote: "label is required because the main button is icon-only; pass actions to turn it into a speed-dial menu.",
    props: [
      { name: "label", type: "string", desc: "Required accessible name for the icon-only button." },
      { name: "icon", type: "IconName", desc: 'Glyph for the main button (default "plus").' },
      { name: "onClick", type: "() => void", desc: "Fired when there are no actions." },
      { name: "actions", type: "FabAction[]", desc: "Speed-dial entries ({ label, icon, onClick })." },
      { name: "position", type: '"br" | "bl"', desc: 'Corner it floats in (default "br").' },
      { name: "tone", type: "Tone", desc: "Accent tone for the main button." },
    ],
  },
  // ---- swipeActions ----
  {
    id: "c-swipeactions",
    name: "swipeActions",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A list row that reveals trailing action buttons when dragged left, operable by pointer and keyboard.",
    importLine: 'import { swipeActions } from "@dxjs/ui";',
    usageCode: `swipeActions({
  children: html\`<div class="row">report.pdf</div>\`,
  actions: [
    { label: "Archive", icon: "box", tone: "info", onSelect: archive },
    { label: "Delete", icon: "trash", tone: "neg", onSelect: remove },
  ],
  ariaLabel: "report.pdf row",
});`,
    demo: () =>
      swipeActions({
        children: html`<div class="gl-row">report.pdf</div>`,
        actions: [
          { label: "Archive", icon: "box", tone: "info", onSelect: () => {} },
          { label: "Delete", icon: "trash", tone: "neg", onSelect: () => {} },
        ],
        ariaLabel: "report.pdf row",
      }),
    populateCode: `["report.pdf", "invoice.xlsx"].map((name) =>
  swipeActions({
    children: html\`<div class="row">\${name}</div>\`,
    actions: [{ label: "Delete", icon: "trash", tone: "neg", onSelect: () => del(name) }],
    ariaLabel: \`\${name} row\`,
  }),
);`,
    populateNote: "The actions are always real buttons, so the row stays usable without a touchscreen; clicking one fires onSelect and snaps shut.",
    props: [
      { name: "children", type: "TemplateResult | string", desc: "The row content shown on the sliding surface." },
      { name: "actions", type: "SwipeAction[]", desc: "Trailing actions ({ label, icon?, tone?, onSelect }) revealed on drag-left." },
      { name: "ariaLabel", type: "string", desc: "Accessible label for the row group." },
    ],
  },
  // ---- pullToRefresh ----
  {
    id: "c-pulltorefresh",
    name: "pullToRefresh",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A container that refreshes when dragged down from the top, with a real refresh button for keyboard users.",
    importLine: 'import { pullToRefresh } from "@dxjs/ui";',
    usageCode: `pullToRefresh({
  onRefresh: () => reload(),   // may return a Promise; busy state is tracked
  label: "Pull to refresh",
  children: list,
});`,
    demo: () =>
      pullToRefresh({
        onRefresh: () => Promise.resolve(),
        label: "Pull to refresh",
        children: html`<div class="gl-stack">
          <div>report.pdf</div>
          <div>invoice-114.xlsx</div>
          <div>notes.md</div>
        </div>`,
      }),
    populateCode: `pullToRefresh({
  onRefresh: async () => { await refetch(); },
  refreshing: isLoading,        // optional external busy state, OR-ed with the internal one
  children: feed,
});`,
    populateNote: "Crossing PULL_THRESHOLD on release (or clicking the indicator button) calls onRefresh; return a Promise to drive the busy state.",
    props: [
      { name: "children", type: "Maybe<TemplateResult | string>", desc: "The scrollable content." },
      { name: "onRefresh", type: "() => void | Promise<void>", desc: "Called when a pull commits; await it to show the busy state." },
      { name: "refreshing", type: "Maybe<boolean>", desc: "Externally controlled busy state, OR-ed with the internal one." },
      { name: "label", type: "string", desc: "Label for the refresh indicator/button." },
    ],
  },
  // ---- pickerWheel ----
  {
    id: "c-pickerwheel",
    name: "pickerWheel",
    pkg: "@dxjs/ui",
    group: "UI · Media & mobile",
    lead: "A vertical wheel selector that centres the chosen row; a focusable listbox with arrow-key navigation.",
    importLine: 'import { pickerWheel } from "@dxjs/ui";',
    usageCode: `pickerWheel({
  options: months,
  value: picked,               // controlled value
  onChange: (v) => picked.set(v),
  visibleCount: 5,
  ariaLabel: "Month",
});`,
    demo: () => {
      const picked = signal("mar");
      return pickerWheel({
        options: [
          { value: "jan", label: "January" },
          { value: "feb", label: "February" },
          { value: "mar", label: "March" },
          { value: "apr", label: "April" },
          { value: "may", label: "May" },
        ],
        value: picked,
        onChange: (v) => picked.set(v),
        ariaLabel: "Month",
      });
    },
    populateCode: `const picked = signal("feb");
const months = [
  { value: "jan", label: "January" },
  { value: "feb", label: "February" },
];
pickerWheel({ options: months, value: picked, onChange: (v) => picked.set(v) });`,
    populateNote: "Each WheelOption is { value, label }; value is controlled, so hold it in a signal and update it in onChange.",
    props: [
      { name: "options", type: "Maybe<WheelOption[]>", desc: "The selectable rows ({ value, label })." },
      { name: "value", type: "Maybe<string>", desc: "The controlled selected value." },
      { name: "onChange", type: "(value: string) => void", desc: "Fired when the selection changes." },
      { name: "visibleCount", type: "number", desc: "Rows visible in the window; odd looks best (default 5)." },
      { name: "ariaLabel", type: "string", desc: "Accessible label for the listbox." },
    ],
  },
];

export const componentPages: Page[] = componentDocs.map(makeComponentPage);
