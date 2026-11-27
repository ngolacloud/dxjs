// examples/ui-gallery — a live gallery of (nearly) every @dxjs/ui component, for
// visual verification against the Sentinel reference on desktop and mobile. Each
// component is rendered with realistic sample data; interactive ones are wired to
// local signals so they actually respond (sliders drag, tabs switch, modals open).
//
// Everything is CSP-safe: components only toggle CSS classes, the gallery's own
// chrome uses classes from gallery.css (no inline styles, no innerHTML, no eval),
// and sample images are inline `data:` SVG (never a network fetch). A light/dark
// toggle and the live viewport width in the header let you watch the adaptive
// layer engage as you narrow the window below ~560px.
import { signal } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { component, mount, onMount } from "@dxjs/component";
import {
  createThemeController,
  createToaster,
  // controls
  button,
  buttonGroup,
  badge,
  input,
  textarea,
  field,
  select,
  switchToggle,
  checkbox,
  radioGroup,
  tagsInput,
  pill,
  card,
  appShell,
  statCard,
  statGrid,
  dataTable,
  // feedback
  alert,
  modal,
  tooltip,
  skeleton,
  spinner,
  progress,
  meter,
  topProgress,
  emptyState,
  // nav
  tabs,
  segmented,
  breadcrumb,
  navPanel,
  avatar,
  divider,
  // layout
  stack,
  grid,
  space,
  splitter,
  // overlay
  drawer,
  dropdown,
  // disclosure
  accordion,
  stepper,
  timeline,
  // popover
  popover,
  popconfirm,
  contextMenu,
  // pagination
  pagination,
  // search / filter
  searchFilter,
  // pickers
  searchableSelect,
  datePicker,
  dateRangePicker,
  timer,
  slider,
  numberInput,
  timePicker,
  calendar,
  // data / tables
  tableList,
  exportMenu,
  virtualList,
  sparkline,
  metric,
  metricGrid,
  // media
  image,
  video,
  carousel,
  worldMap,
  starRating,
  descriptionList,
  tree,
  // planning
  gantt,
  planner,
  kanban,
  taskPanel,
  commandPalette,
  icon,
  iconNames,
  fileUpload,
  // mobile / touch
  bottomSheet,
  actionSheet,
  tabBar,
  fab,
  swipeActions,
  pullToRefresh,
  pickerWheel,
} from "@dxjs/ui";

// --- sample data -----------------------------------------------------------

/** An inline data: SVG — same-origin, never a network fetch (img-src 'self' data:). */
const svgImg = (label: string, c1: string, c2: string): string =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180">` +
      `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
      `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>` +
      `<rect width="320" height="180" fill="url(#g)"/>` +
      `<text x="160" y="98" font-family="sans-serif" font-size="20" font-weight="600" ` +
      `fill="white" text-anchor="middle">${label}</text></svg>`,
  );

interface Account {
  id: number;
  name: string;
  plan: string;
  mrr: number;
  seats: number;
}
const ACCOUNTS: Account[] = [
  { id: 1, name: "Acme Angola", plan: "Enterprise", mrr: 4200, seats: 120 },
  { id: 2, name: "Globex Luanda", plan: "Growth", mrr: 980, seats: 24 },
  { id: 3, name: "Initech Benguela", plan: "Starter", mrr: 190, seats: 6 },
  { id: 4, name: "Umbrella Huambo", plan: "Growth", mrr: 1450, seats: 38 },
  { id: 5, name: "Soylent Lobito", plan: "Enterprise", mrr: 5100, seats: 210 },
  { id: 6, name: "Hooli Namibe", plan: "Starter", mrr: 240, seats: 9 },
  { id: 7, name: "Stark Cabinda", plan: "Growth", mrr: 1120, seats: 31 },
  { id: 8, name: "Wayne Malanje", plan: "Enterprise", mrr: 6300, seats: 275 },
];

// --- gallery ---------------------------------------------------------------

/** Build and mount the gallery into `host`. Returns a disposer. */
export function mountApp(host: Element): () => void {
  const theme = createThemeController("dark");
  const toaster = createToaster();

  // --- interactive state (so controlled components actually respond) -------
  const inputV = signal("Jane Doe");
  const areaV = signal("Multi-line\ntext area");
  const selectV = signal("ao");
  const switchV = signal(true);
  const checkV = signal(false);
  const radioV = signal("week");
  const tagsV = signal<string[]>(["angola", "cloud"]);
  const sliderV = signal(40);
  const numberV = signal(3);
  const searchSelV = signal("pt");
  const dateV = signal("2026-11-27");
  const rangeS = signal("2026-11-03");
  const rangeE = signal("2026-11-14");
  const timeV = signal("09:30");
  const calV = signal("2026-11-27");
  const ratingV = signal(3.5);
  const tabV = signal("all");
  const segV = signal("week");
  const pageV = signal(0);
  const treeSel = signal("src/app");
  const wheelV = signal("feb");
  const tabBarV = signal("home");
  const stepV = signal("s2");

  // overlays
  const modalOpen = signal(false);
  const drawerOpen = signal(false);
  const bsheetOpen = signal(false);
  const asheetOpen = signal(false);
  const paletteOpen = signal(false);

  // live viewport width (drives the header chip; the kit's media queries do the
  // real adaptive work as the browser narrows).
  const vw = signal(typeof window !== "undefined" ? window.innerWidth : 1024);

  const toast = (): void =>
    toaster.push({ tone: "pos", title: "Saved", message: "Your changes were saved." });

  // --- small layout helpers (gallery chrome, class-only) -------------------
  const demo = (label: string, node: TemplateResult | string, wide = false): TemplateResult =>
    html`<div class=${wide ? "gx-demo is-wide" : "gx-demo"}>
      <div class="gx-demo-label">${label}</div>
      <div class="gx-demo-body">${node}</div>
    </div>`;

  const section = (id: string, title: string, demos: TemplateResult[]): TemplateResult =>
    html`<section id=${id} class="gx-sec">
      <h2 class="gx-sec-title">${title}</h2>
      <div class="gx-grid">${demos}</div>
    </section>`;

  // --- sections ------------------------------------------------------------

  const controls = section("controls", "Controls", [
    demo(
      "button — variants",
      stack({
        direction: "row",
        gap: 2,
        wrap: true,
        align: "center",
        children: [
          button({ label: "Primary", variant: "primary", onClick: toast }),
          button({ label: "Default", onClick: toast }),
          button({ label: "Ghost", variant: "ghost", onClick: toast }),
          button({ label: "Subtle", variant: "subtle", onClick: toast }),
          button({ label: "Danger", variant: "danger", onClick: toast }),
          button({ label: "Loading", loading: true }),
          button({ label: "Disabled", disabled: true }),
        ],
      }),
    ),
    demo(
      "button — sizes + group",
      stack({
        direction: "row",
        gap: 3,
        wrap: true,
        align: "center",
        children: [
          button({ label: "xs", size: "xs" }),
          button({ label: "sm", size: "sm" }),
          button({ label: "md", size: "md" }),
          button({ label: "lg", size: "lg" }),
          buttonGroup([
            button({ label: "Day", variant: "subtle" }),
            button({ label: "Week", variant: "subtle" }),
            button({ label: "Month", variant: "subtle" }),
          ]),
        ],
      }),
    ),
    demo(
      "badge / pill",
      stack({
        direction: "row",
        gap: 2,
        wrap: true,
        align: "center",
        children: [
          badge("NEW", "info"),
          badge("OK", "pos"),
          badge("WARN", "warn"),
          badge("DOWN", "neg"),
          pill("active", "pos"),
          pill("paused", "mut"),
          pill("over quota", "warn"),
        ],
      }),
    ),
    demo("input", input({ value: inputV, onInput: (v) => inputV.set(v), placeholder: "Your name" })),
    demo("textarea", textarea({ value: areaV, onInput: (v) => areaV.set(v), rows: 3 })),
    demo(
      "field — hint",
      field({ label: "Email", hint: "We never share it.", placeholder: "you@example.com", type: "email" }),
    ),
    demo(
      "field — error",
      field({ label: "Password", error: "At least 8 characters.", type: "password", value: "x", required: true }),
    ),
    demo(
      "select",
      select({
        value: selectV,
        onChange: (v) => selectV.set(v),
        options: [
          { value: "ao", label: "Angola" },
          { value: "pt", label: "Portugal" },
          { value: "br", label: "Brasil" },
        ],
      }),
    ),
    demo("switch", switchToggle({ checked: switchV, onChange: (v) => switchV.set(v), label: "Notifications" })),
    demo("checkbox", checkbox({ checked: checkV, onChange: (v) => checkV.set(v), label: "I agree" })),
    demo(
      "radio group",
      radioGroup({
        value: radioV,
        onChange: (v) => radioV.set(v),
        options: [
          { value: "day", label: "Day" },
          { value: "week", label: "Week" },
          { value: "month", label: "Month" },
        ],
      }),
    ),
    demo(
      "tags input",
      tagsInput({ value: tagsV, onChange: (t) => tagsV.set(t), placeholder: "Add a tag…" }),
    ),
  ]);

  const feedback = section("feedback", "Feedback & status", [
    demo("alert — info", alert({ tone: "info", title: "Heads up", body: "A new version is available." })),
    demo(
      "alert — success (dismissible)",
      alert({ tone: "pos", title: "Deployed", body: "Build #482 is live.", onDismiss: toast }),
    ),
    demo("alert — warn", alert({ tone: "warn", body: "You are near your storage quota." })),
    demo("alert — error", alert({ tone: "neg", title: "Failed", body: "Could not reach the API." })),
    demo("spinner", spinner("Loading")),
    demo("skeleton — lines", skeleton({ kind: "line", lines: 3 })),
    demo("skeleton — circle + rect", stack({ direction: "row", gap: 3, align: "center", children: [skeleton({ kind: "circle" }), skeleton({ kind: "rect" })] })),
    demo("progress", progress({ value: 64, showValue: true, tone: "info" })),
    demo("meter — CPU", meter({ value: 0.72, tone: "warn", label: "CPU" })),
    demo("top progress", topProgress({ value: 0.4 })),
    demo(
      "empty state",
      emptyState({ title: "No results", description: "Try a different filter.", action: { label: "Reset", onClick: toast } }),
    ),
    demo(
      "card",
      card({ title: "Resumo da frota", body: html`<p class="gx-cardtext">128 dispositivos activos · 3 offline · 2 em quarentena.</p>` }),
    ),
    demo(
      "stat card",
      stack({ direction: "row", gap: 3, wrap: true, children: [statCard({ label: "MRR", value: "$21.4k", delta: "+8%", tone: "pos" }), statCard({ label: "Churn", value: "2.1%", delta: "-0.3%", tone: "neg" })] }),
    ),
    demo(
      "stat grid",
      statGrid([
        { label: "MRR", value: "$21.4k", delta: "+8%", tone: "pos" },
        { label: "Accounts", value: "128", delta: "+4", tone: "pos" },
        { label: "Churn", value: "2.1%", delta: "-0.3%", tone: "neg" },
        { label: "Tickets", value: "12", tone: "mut" },
      ]),
    ),
  ]);

  const overlays = section("overlays", "Overlays & disclosure", [
    demo(
      "modal",
      button({ label: "Open modal", variant: "primary", onClick: () => modalOpen.set(true) }),
    ),
    demo("drawer", button({ label: "Open drawer", onClick: () => drawerOpen.set(true) })),
    demo(
      "dropdown menu",
      dropdown({
        label: "Actions",
        items: [
          { label: "Edit", icon: icon("sliders", { size: 15 }), onSelect: toast },
          { label: "Duplicate", icon: icon("plus", { size: 15 }), onSelect: toast },
          { label: "Delete", danger: true, separator: true, icon: icon("trash", { size: 15 }), onSelect: toast },
        ],
      }),
    ),
    demo("popover", popover({ trigger: button({ label: "Show popover" }), content: "A small floating panel with details." })),
    demo(
      "popconfirm",
      popconfirm({
        trigger: button({ label: "Delete", variant: "danger" }),
        title: "Delete item?",
        message: "This cannot be undone.",
        onConfirm: toast,
      }),
    ),
    demo(
      "context menu",
      contextMenu({
        children: html`<div class="gx-ctx">Right-click me</div>`,
        items: [
          { label: "Copy", icon: "file-text", onSelect: toast },
          { label: "Refresh", icon: "refresh", onSelect: toast },
          { label: "Delete", icon: "trash", danger: true, separator: true, onSelect: toast },
        ],
      }),
    ),
    demo("tooltip", tooltip({ children: button({ label: "Hover me" }), tip: "I appear on hover & focus" })),
    demo(
      "command palette",
      button({ label: "Open palette (⌘K)", onClick: () => paletteOpen.set(true) }),
    ),
    demo(
      "accordion",
      accordion({
        items: [
          { id: "a", title: "What is dxjs?", body: "A lean, secure, fine-grained reactive UI engine." },
          { id: "b", title: "Is it CSP-safe?", body: "Yes — no eval, no inline styles, escaped output." },
          { id: "c", title: "Does it tree-shake?", body: "Yes — sideEffects:false, per-component imports." },
        ],
        defaultOpen: ["a"],
      }),
    ),
    demo(
      "stepper",
      stepper({
        steps: [
          { id: "s1", label: "Account" },
          { id: "s2", label: "Profile", description: "Your info" },
          { id: "s3", label: "Done" },
        ],
        active: stepV,
        onStep: (id) => stepV.set(id),
      }),
    ),
    demo(
      "timeline",
      timeline([
        { title: "Created", time: "Nov 20", tone: "pos" },
        { title: "Built", time: "Nov 24", body: "Image pushed to registry." },
        { title: "Deployed", time: "Nov 27", tone: "info" },
      ]),
    ),
  ]);

  const nav = section("nav", "Navigation & layout", [
    demo("tabs", tabs({ tabs: [{ id: "all", label: "All", count: 12 }, { id: "open", label: "Open", count: 3 }, { id: "closed", label: "Closed" }], active: tabV, onSelect: (id) => tabV.set(id) })),
    demo("segmented", segmented({ options: [{ value: "day", label: "Day" }, { value: "week", label: "Week" }, { value: "month", label: "Month" }], value: segV, onChange: (v) => segV.set(v) })),
    demo("breadcrumb", breadcrumb([{ label: "Home", onClick: toast }, { label: "Projects", onClick: toast }, { label: "dxjs" }])),
    demo(
      "nav panel",
      navPanel({
        groups: [
          { label: "Main", items: [{ id: "home", label: "Home", icon: icon("home", { size: 16 }), badge: 3 }, { id: "inbox", label: "Inbox", icon: icon("bell", { size: 16 }) }] },
          { label: "Admin", items: [{ id: "users", label: "Users", icon: icon("users", { size: 16 }) }, { id: "keys", label: "API keys", icon: icon("key", { size: 16 }) }] },
        ],
        active: "home",
        onSelect: toast,
      }),
    ),
    demo("avatar", stack({ direction: "row", gap: 2, align: "center", children: [avatar({ initials: "JD", name: "Jane Doe", size: "sm" }), avatar({ initials: "AR", size: "md" }), avatar({ initials: "WX", size: "lg" })] })),
    demo("divider", html`<div>Above${divider("Section")}Below</div>`),
    demo("stack (row)", stack({ direction: "row", gap: 2, justify: "between", align: "center", children: [pill("one", "info"), pill("two", "pos"), pill("three", "warn")] })),
    demo("grid (3 cols)", grid({ cols: 3, gap: 2, children: [badge("A", "info"), badge("B", "pos"), badge("C", "warn"), badge("D", "neg"), badge("E", "mut"), badge("F", "info")] })),
    demo("space", html`<span>Left</span>${space("xl")}<span>Right</span>`),
    demo("splitter", html`<div class="gx-splitwrap">${splitter({ start: html`<div class="gx-pane">Left pane</div>`, end: html`<div class="gx-pane">Right pane</div>`, initial: 0.45, min: 80 })}</div>`, true),
    demo("pagination", pagination({ page: pageV, total: 240, pageSize: 20, pageSizes: [10, 20, 50], labelRange: true, onPage: (p) => pageV.set(p), onPageSize: toast }), true),
  ]);

  const pickers = section("pickers", "Pickers & inputs", [
    demo("slider", slider({ value: sliderV, min: 0, max: 100, step: 5, marks: [0, 25, 50, 75, 100], ariaLabel: "Volume", onInput: (v) => sliderV.set(v) })),
    demo("number input", numberInput({ value: numberV, min: 0, max: 10, ariaLabel: "Quantity", onChange: (v) => numberV.set(v) })),
    demo("rating", starRating({ value: ratingV, max: 5, allowHalf: true, onChange: (v) => ratingV.set(v) })),
    demo(
      "searchable select",
      searchableSelect({
        value: searchSelV,
        onChange: (v) => searchSelV.set(v as string),
        placeholder: "Pick a country",
        options: [
          { value: "ao", label: "Angola" },
          { value: "pt", label: "Portugal" },
          { value: "br", label: "Brasil" },
          { value: "cv", label: "Cabo Verde" },
          { value: "mz", label: "Moçambique" },
        ],
      }),
    ),
    demo("date picker", datePicker({ value: dateV, onChange: (iso) => dateV.set(iso), weekStart: 1 })),
    demo("date range", dateRangePicker({ start: rangeS, end: rangeE, onChange: (s, e) => { rangeS.set(s); rangeE.set(e); } })),
    demo("time picker", timePicker({ value: timeV, onChange: (t) => timeV.set(t), step: 30, hour12: false })),
    demo("timer (countdown)", timer({ mode: "countdown", seconds: 90, onComplete: toast })),
    demo(
      "calendar",
      calendar({
        value: calV,
        onSelect: (iso) => calV.set(iso),
        weekStart: 1,
        holidays: true,
        events: [{ date: "2026-11-27", title: "Reunião", tone: "info" }],
      }),
      true,
    ),
    demo(
      "search / filter bar",
      searchFilter({
        fields: [{ key: "name", label: "Name" }, { key: "plan", label: "Plan" }],
        filters: [{ id: "active", label: "Active" }, { id: "trial", label: "Trial" }],
        groupBy: [{ id: "plan", label: "Plan" }],
        onChange: () => {},
      }),
      true,
    ),
    demo("file upload", fileUpload({
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
    }), true),
  ]);

  const dataViz = section("data", "Data & visualization", [
    demo(
      "data table",
      dataTable<Account>({
        title: "Accounts",
        columns: [
          { key: "name", label: "Name", sortable: true },
          { key: "plan", label: "Plan", sortable: true, render: (r) => pill(r.plan, r.plan === "Enterprise" ? "pos" : r.plan === "Growth" ? "info" : "mut") },
          { key: "mrr", label: "MRR", numeric: true, sortable: true, value: (r) => r.mrr },
          { key: "seats", label: "Seats", numeric: true, sortable: true },
        ],
        rows: ACCOUNTS,
        rowKey: (r) => r.id,
        search: true,
        pageSize: 5,
        striped: true,
        exportable: true,
      }),
      true,
    ),
    demo(
      "table list (simple)",
      tableList<Account>({
        columns: [
          { key: "name", label: "Name", sortable: true },
          { key: "mrr", label: "MRR", numeric: true, sortable: true },
        ],
        rows: ACCOUNTS.slice(0, 4),
        rowKey: (r) => r.id,
        density: "compact",
      }),
      true,
    ),
    demo(
      "virtual list (10k rows)",
      html`<div class="gx-vlistwrap">${virtualList<{ id: number; name: string }>({
        rows: Array.from({ length: 10000 }, (_, i) => ({ id: i, name: `Row ${i + 1}` })),
        rowHeight: 32,
        height: 240,
        key: (r) => r.id,
        render: (r) => html`<div class="gx-vrow">${r.name}</div>`,
      })}</div>`,
      true,
    ),
    demo("sparkline", stack({ direction: "row", gap: 3, align: "center", children: [sparkline({ data: [3, 5, 2, 8, 6, 9, 7], tone: "pos", fill: true, dot: true }), sparkline({ data: [9, 6, 7, 4, 5, 2, 3], tone: "neg" })] })),
    demo(
      "metric (single)",
      metric({ label: "Revenue", value: "$48.2k", delta: "+12%", tone: "pos", trend: [10, 14, 12, 18, 22], hint: "vs mês anterior" }),
    ),
    demo(
      "export menu",
      exportMenu<Account>({
        rows: () => ACCOUNTS,
        columns: [{ key: "name", label: "Name" }, { key: "plan", label: "Plan" }, { key: "mrr", label: "MRR" }, { key: "seats", label: "Seats" }],
        filename: "accounts",
      }),
    ),
    demo(
      "metric grid",
      metricGrid([
        { label: "Revenue", value: "$48.2k", delta: "+12%", tone: "pos", trend: [10, 14, 12, 18, 22] },
        { label: "Active users", value: 1280, delta: "+4%", tone: "pos", trend: [8, 9, 11, 10, 13] },
        { label: "Error rate", value: "0.4%", delta: "-0.1%", tone: "neg", trend: [5, 4, 4, 3, 2] },
      ]),
      true,
    ),
    demo(
      "description list",
      descriptionList({
        columns: 2,
        bordered: true,
        items: [
          { term: "Name", value: "Acme Angola" },
          { term: "Plan", value: pill("Enterprise", "pos") },
          { term: "Seats", value: "120" },
          { term: "Notes", value: "Renews in Q2 2027", span: true },
        ],
      }),
      true,
    ),
    demo(
      "tree",
      tree({
        nodes: [
          { id: "src", label: "src", icon: "folder", children: [{ id: "src/index", label: "index.ts", icon: "file-text" }, { id: "src/app", label: "app.ts", icon: "file-text" }] },
          { id: "pkg", label: "package.json", icon: "file-text" },
        ],
        defaultExpanded: ["src"],
        selected: treeSel,
        onSelect: (id) => treeSel.set(id),
      }),
    ),
    demo("world map", worldMap({ markers: [{ lon: 13.2, lat: -8.8, label: "Luanda", tone: "pos" }, { lon: -74, lat: 40.7, label: "NYC", tone: "info" }, { lon: 2.35, lat: 48.85, label: "Paris" }] }), true),
    demo("picker wheel", pickerWheel({ options: [{ value: "jan", label: "January" }, { value: "feb", label: "February" }, { value: "mar", label: "March" }, { value: "apr", label: "April" }, { value: "may", label: "May" }], value: wheelV, onChange: (v) => wheelV.set(v), ariaLabel: "Month" })),
  ]);

  const media = section("media", "Media", [
    demo("image", image({ src: svgImg("16 / 9", "#6366f1", "#8b5cf6"), alt: "Sample gradient", ratio: "16/9", rounded: true, caption: "An inline data: SVG" }), true),
    demo("video", video({ src: "", poster: svgImg("video poster", "#0ea5e9", "#14b8a6"), controls: true, ratio: "16/9", caption: "Poster shown; media blocked by CSP" }), true),
    demo(
      "carousel",
      carousel({
        slides: [
          image({ src: svgImg("Slide 1", "#ef4444", "#f97316"), alt: "Slide 1", ratio: "16/9" }),
          image({ src: svgImg("Slide 2", "#22c55e", "#14b8a6"), alt: "Slide 2", ratio: "16/9" }),
          image({ src: svgImg("Slide 3", "#6366f1", "#a855f7"), alt: "Slide 3", ratio: "16/9" }),
        ],
        showDots: true,
        showArrows: true,
      }),
      true,
    ),
  ]);

  const planning = section("planning", "Planning boards", [
    demo(
      "gantt",
      gantt({
        tasks: [
          { id: "t1", label: "Design", start: "2026-01-05", end: "2026-01-18", tone: "info", progress: 60, assignee: "AR" },
          { id: "t2", label: "Build", start: "2026-01-15", end: "2026-02-10", progress: 25 },
          { id: "t3", label: "Ship", start: "2026-02-08", end: "2026-02-20", tone: "pos" },
        ],
        today: "2026-01-20",
      }),
      true,
    ),
    demo(
      "planner (week)",
      planner({
        events: [
          { id: "e1", day: 1, start: "09:00", end: "10:30", title: "Standup", tone: "info" },
          { id: "e2", day: 3, start: "13:00", end: "14:00", title: "Review", tone: "pos" },
          { id: "e3", day: 4, start: "11:00", end: "12:00", title: "1:1", tone: "warn" },
        ],
        weekStart: 1,
        todayDay: 3,
        now: "13:30",
        onSelect: toast,
      }),
      true,
    ),
    demo(
      "kanban",
      kanban({
        columns: [
          { id: "todo", title: "To Do", accent: "mut", cards: [{ id: "c1", title: "Spec API", meta: "AR · Nov 30", tags: ["backend"] }, { id: "c2", title: "Design modal", tags: ["ui"] }] },
          { id: "doing", title: "Doing", accent: "info", cards: [{ id: "c3", title: "Build gallery", meta: "JS", body: "Render every component" }] },
          { id: "done", title: "Done", accent: "pos", cards: [{ id: "c4", title: "CSP gate" }] },
        ],
        onMove: toast,
      }),
      true,
    ),
    demo(
      "task panel",
      taskPanel({
        title: "Sprint 12",
        tasks: [
          { id: "t1", title: "Wire up auth", assignee: "AR", due: "Nov 30", priority: "high", progress: 0.4 },
          { id: "t2", title: "Write docs", assignee: "JS", priority: "med", progress: 0.1 },
          { id: "t3", title: "Ship gallery", done: true },
        ],
        onToggle: toast,
        onSelect: toast,
        action: { label: "Add task", icon: "plus", onClick: toast },
      }),
      true,
    ),
  ]);

  // Icon catalogue — every IconName the kit ships.
  const icons = section(
    "icons",
    "Icons",
    [
      demo(
        `icon set (${iconNames.length})`,
        html`<div class="gx-icons">${iconNames.map(
          (n) => html`<div class="gx-ico"><div class="gx-ico-glyph">${icon(n, { size: 22 })}</div><div class="gx-ico-name">${n}</div></div>`,
        )}</div>`,
        true,
      ),
    ],
  );

  // Mobile / touch surfaces live inside a device frame. The frame sets a
  // transform, which makes it the containing block for the kit's
  // position:fixed surfaces (bottom sheet, action sheet, tab bar, FAB) — so
  // they dock to the phone, not the whole page. Narrow the real browser to see
  // the same components adapt at viewport scale.
  const phone = section("mobile", "Mobile & touch", [
    html`<div class="gx-demo is-wide">
      <div class="gx-demo-label">device frame — tab bar · FAB · sheets · swipe · pull-to-refresh</div>
      <div class="gx-demo-body">
        <div class="gx-phone">
          <div class="gx-phone-screen">
            <div class="gx-phone-head">Inbox</div>
            ${pullToRefresh({
              onRefresh: () => new Promise((r) => setTimeout(r, 800)),
              label: "Pull to refresh",
              children: html`<div class="gx-phone-list">
                ${["report.pdf", "invoice-114.xlsx", "photo.png", "notes.md"].map(
                  (name) =>
                    swipeActions({
                      children: html`<div class="gx-phone-row">${name}</div>`,
                      actions: [
                        { label: "Archive", icon: "box", tone: "info", onSelect: toast },
                        { label: "Delete", icon: "trash", tone: "neg", onSelect: toast },
                      ],
                      ariaLabel: `${name} row`,
                    }),
                )}
              </div>`,
            })}
            <div class="gx-phone-actions">
              ${button({ label: "Bottom sheet", block: true, onClick: () => bsheetOpen.set(true) })}
              ${button({ label: "Action sheet", block: true, variant: "subtle", onClick: () => asheetOpen.set(true) })}
            </div>
            ${pickerWheel({
              options: [
                { value: "jan", label: "January" },
                { value: "feb", label: "February" },
                { value: "mar", label: "March" },
                { value: "apr", label: "April" },
                { value: "may", label: "May" },
              ],
              value: wheelV,
              onChange: (v) => wheelV.set(v),
              ariaLabel: "Month",
            })}
          </div>
          ${fab({ label: "Compose", icon: "plus", actions: [{ label: "New mail", icon: "file-text", onClick: toast }, { label: "Upload", icon: "upload", onClick: toast }] })}
          ${tabBar({
            items: [
              { id: "home", label: "Home", icon: "home" },
              { id: "files", label: "Files", icon: "folder", badge: 3 },
              { id: "people", label: "People", icon: "users" },
              { id: "me", label: "Me", icon: "shield" },
            ],
            active: tabBarV,
            onSelect: (id) => tabBarV.set(id),
          })}
          ${bottomSheet({ open: bsheetOpen, onClose: () => bsheetOpen.set(false), title: "Share file", body: "Choose where to send report.pdf.", footer: button({ label: "Done", variant: "primary", onClick: () => bsheetOpen.set(false) }) })}
          ${actionSheet({
            open: asheetOpen,
            onClose: () => asheetOpen.set(false),
            title: "report.pdf",
            actions: [
              { label: "Rename", icon: "sliders", onSelect: toast },
              { label: "Download", icon: "download", onSelect: toast },
              { label: "Delete", icon: "trash", danger: true, onSelect: toast },
            ],
          })}
        </div>
      </div>
    </div>`,
  ]);

  // App shell — contained in a device-like frame so the full-height grid docks
  // to the card instead of the page.
  const shell = section("shell", "App shell", [
    html`<div class="gx-demo is-wide">
      <div class="gx-demo-label">appShell — sidebar · topbar · conteúdo</div>
      <div class="gx-demo-body">
        <div class="gx-shellwrap">
          ${appShell({
            brand: "Sentinel",
            nav: [
              { label: "Painel", active: true, onSelect: toast },
              { label: "Dispositivos", onSelect: toast },
              { label: "Eventos", onSelect: toast },
              { label: "Topologia", onSelect: toast },
              { label: "Comandos", onSelect: toast },
            ],
            user: { name: "Jane Doe", initials: "JD" },
            search: { placeholder: "Procurar ou saltar para…", onInput: () => {} },
            content: html`<div class="gx-shellcontent">
              <h1 class="gx-shelltitle">Painel</h1>
              <p class="gx-shellsub">Visão da frota em tempo quase real.</p>
              ${statGrid([
                { label: "Dispositivos", value: "128", delta: "+4", tone: "pos" },
                { label: "Offline", value: "3", tone: "warn" },
                { label: "Quarentena", value: "2", tone: "neg" },
                { label: "Eventos/h", value: "1.2k", delta: "+6%", tone: "pos" },
              ])}
            </div>`,
          })}
        </div>
      </div>
    </div>`,
  ]);

  // --- nav + shell ---------------------------------------------------------
  const NAV = [
    ["shell", "App shell"],
    ["controls", "Controls"],
    ["feedback", "Feedback"],
    ["overlays", "Overlays"],
    ["nav", "Nav & layout"],
    ["pickers", "Pickers"],
    ["data", "Data"],
    ["media", "Media"],
    ["planning", "Planning"],
    ["icons", "Icons"],
    ["mobile", "Mobile"],
  ] as const;

  const App = component(() => {
    onMount(() => {
      const onResize = (): void => vw.set(window.innerWidth);
      window.addEventListener("resize", onResize);
      const onKey = (e: KeyboardEvent): void => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
          e.preventDefault();
          paletteOpen.set(!paletteOpen());
        }
      };
      document.addEventListener("keydown", onKey);
      return () => {
        window.removeEventListener("resize", onResize);
        document.removeEventListener("keydown", onKey);
      };
    });

    return html`<div class="gx">
      <header class="gx-top">
        <div class="gx-brand">@dxjs/ui <span class="gx-brand-sub">component gallery</span></div>
        <nav class="gx-nav" aria-label="Sections">
          ${NAV.map(([id, label]) => html`<a class="gx-nav-link" href=${`#${id}`}>${label}</a>`)}
        </nav>
        <div class="gx-tools">
          ${() => pill(`${vw()}px · ${vw() < 560 ? "mobile" : "desktop"}`, vw() < 560 ? "warn" : "mut")}
          ${() => pill(theme.theme() === "dark" ? "dark" : "light", "info")}
          ${button({ icon: () => icon(theme.theme() === "dark" ? "sun" : "moon", { size: 16 }), label: "Theme", onClick: () => theme.toggle() })}
        </div>
      </header>
      <p class="gx-hint">
        Toggle the theme above and narrow the window below ~560px: controls grow to ≥44px touch targets,
        overlays go full-screen, and the mobile surfaces (bottom sheet, action sheet, tab bar) dock to the edges.
      </p>
      <main class="gx-main">
        ${shell}
        ${controls}
        ${feedback}
        ${overlays}
        ${nav}
        ${pickers}
        ${dataViz}
        ${media}
        ${planning}
        ${icons}
        ${phone}
      </main>

      <!-- app-level overlays: rendered at the root so they cover the true viewport -->
      ${modal({
        open: modalOpen,
        title: "Edit account",
        body: html`<div class="gx-modal-body">${field({ label: "Account name", value: "Acme Angola" })}${field({ label: "Plan", value: "Enterprise" })}</div>`,
        footer: buttonGroup([button({ label: "Cancel", variant: "subtle", onClick: () => modalOpen.set(false) }), button({ label: "Save", variant: "primary", onClick: () => { modalOpen.set(false); toast(); } })]),
        onClose: () => modalOpen.set(false),
      })}
      ${drawer({
        open: drawerOpen,
        side: "right",
        title: "Details",
        body: html`<div>${descriptionList({ items: [{ term: "Status", value: pill("active", "pos") }, { term: "Region", value: "Luanda" }, { term: "Owner", value: "Jane Doe" }] })}</div>`,
        footer: button({ label: "Close", onClick: () => drawerOpen.set(false) }),
        onClose: () => drawerOpen.set(false),
      })}
      ${commandPalette({
        open: paletteOpen,
        onClose: () => paletteOpen.set(false),
        groups: [
          { heading: "Navigation", items: [{ id: "home", label: "Go Home", icon: "home", shortcut: "G H", onRun: () => paletteOpen.set(false) }, { id: "search", label: "Search files", icon: "search", keywords: ["find"], onRun: () => paletteOpen.set(false) }] },
          { heading: "Actions", items: [{ id: "new", label: "New account", icon: "plus", shortcut: "⌘N", onRun: () => { paletteOpen.set(false); modalOpen.set(true); } }, { id: "theme", label: "Toggle theme", icon: "moon", onRun: () => { paletteOpen.set(false); theme.toggle(); } }] },
        ],
      })}
      ${toaster.host({ placement: "bottom", align: "end" })}
    </div>`;
  });

  return mount(App, host, {});
}
