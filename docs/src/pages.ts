// The documentation pages — each a dxjs component. The live examples use the real
// primitives (dogfooding): what you read in the code pane is what renders beside it.
import { signal, computed } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { component, onMount, type Component } from "@dxjs/component";
import { statGrid, dataTable, pill } from "@dxjs/ui";
import { chart } from "@dxjs/charts";
import { renderToString } from "@dxjs/server";
import { example, p, h2 } from "./example.ts";

export interface Page {
  id: string;
  label: string;
  group: string;
  view: Component;
}

const head = (title: string, lead: string): TemplateResult =>
  html`<h1 class="doc-h1">${title}</h1><p class="doc-lead">${lead}</p>`;

// --- Getting started -------------------------------------------------------
const GettingStarted = component(() => html`
  ${head("Getting started", "dxjs runs vanilla in the browser (no build) and in Node. Pick your path.")}
  ${h2("Vanilla — one file, no bundler")}
  ${example({
    title: "Load the single-file bundle",
    code: `<!-- open this .html directly; no build step -->
<div id="app"></div>
<script type="module">
  import { signal, html, component, mount }
    from "./dxjs.js";          // cdn/dxjs.js (core+dom+component+ui)

  const App = component(() => {
    const n = signal(0);
    return html\`<button @click=\${() => n.update(x => x + 1)}>
      n = \${() => n()}
    </button>\`;
  });
  mount(App, document.getElementById("app"), {});
</script>`,
    note: "cdn/dxjs.js is ~4.5 KB gzip (core+dom+component+ui). Charts are a separate opt-in bundle, cdn/dxjs-charts.js.",
  })}
  ${h2("Vanilla — keep @dxjs/* specifiers via an import map")}
  ${example({
    title: "Import map",
    code: `<script type="importmap">{"imports":{
  "@dxjs/core":"./dxjs.js", "@dxjs/dom":"./dxjs.js",
  "@dxjs/component":"./dxjs.js", "@dxjs/ui":"./dxjs.js"
}}</script>
<script type="module">
  import { signal } from "@dxjs/core";   // resolves to ./dxjs.js
  import { html }   from "@dxjs/dom";
</script>`,
  })}
  ${h2("Node")}
  ${example({
    title: "No build to run — Node executes the TypeScript directly",
    code: `# Node >= 22 runs dxjs's TypeScript via native type-stripping
npm install           # workspace links @dxjs/* → packages/*
node --test           # run the suites, native .ts, no transpile

# in code:
import { signal, computed } from "@dxjs/core";
const n = signal(1);
const double = computed(() => n() * 2);`,
    note: "Same packages, same source — the browser gets a bundle, Node runs the .ts.",
  })}
  ${h2("Security")}
  ${p("Every example on this site runs under a strict Content-Security-Policy (default-src 'none'; script-src 'self'; style-src 'self') — no eval, no inline handlers, output escaped by default. That is the premise dxjs is built on.")}
`);

// --- core ------------------------------------------------------------------
const CorePage = component(() => {
  const n = signal(0);
  const doubled = computed(() => n() * 2);
  return html`
    ${head("@dxjs/core", "Fine-grained reactivity: signals, computeds, effects. No VDOM, no re-renders — updates are surgical.")}
    ${example({
      title: "signal + computed",
      code: `const n = signal(0);
const doubled = computed(() => n() * 2);

html\`<button @click=\${() => n.update(x => x + 1)}>
  +1
</button> n=\${() => n()} · doubled=\${() => doubled()}\``,
      view: html`<div class="demo-row">
        <button class="demo-btn" @click=${() => n.update((x) => x + 1)}>+1</button>
        <span class="demo-out">n = ${() => n()} · doubled = ${() => doubled()}</span>
      </div>`,
      note: "The component runs ONCE; only the two text bindings re-run when n changes.",
    })}
    ${p("Also in core: effect (run a side-effect and re-run on dependency change), batch (coalesce writes), untrack, onCleanup, and createRoot (an owned reactive scope with deterministic teardown).")}
  `;
});

// --- dom -------------------------------------------------------------------
const DomPage = component(() => {
  const name = signal("world");
  const items = signal(["alpha", "beta", "gamma"]);
  return html`
    ${head("@dxjs/dom", "The safe, reactive renderer: html`` compiled once; values bound through safe sinks (textContent, setAttribute, .prop, ?attr, @event). Escaped by default.")}
    ${example({
      title: "Two-way-ish binding + reactive text",
      code: `const name = signal("world");
html\`
  <input @input=\${e => name.set(e.target.value)} />
  <p>Hello, \${() => name()}!</p>\``,
      view: html`<div class="demo-row">
        <input class="demo-input" value=${name()} @input=${(e: Event) => name.set((e.target as HTMLInputElement).value)} />
        <span class="demo-out">Hello, ${() => name()}!</span>
      </div>`,
    })}
    ${example({
      title: "Keyed lists with list()",
      code: `const items = signal(["alpha","beta","gamma"]);
html\`<ul>\${list(() => items(), x => x, x =>
  html\`<li>\${x}</li>\`)}</ul>\``,
      view: html`<ul>${list(() => items(), (x) => x, (x) => html`<li class="demo-out">${x}</li>`)}</ul>`,
      note: "Rows keyed by identity: stable nodes across add/remove/reorder, no full rebuild.",
    })}
    ${example({
      title: "XSS-safe by construction",
      code: `const evil = '<img onerror=alert(1) src=x>';
html\`<div>\${evil}</div>\`  // rendered as TEXT, never parsed`,
      view: html`<code class="demo-out">${'<img onerror=alert(1) src=x>'}</code>`,
      note: "Interpolated data goes through a text sink — the markup shows as inert text, not an element.",
    })}
  `;
});

// --- component -------------------------------------------------------------
const ComponentPage = component(() => {
  const mounted = signal("(waiting…)");
  onMount(() => {
    mounted.set("onMount fired ✓");
    return () => {};
  });
  return html`
    ${head("@dxjs/component", "Function components that run once, mount/onMount/onCleanup lifecycle, and a History-API router with lazy routes and UX guards.")}
    ${example({
      title: "component + onMount",
      code: `const App = component(() => {
  const msg = signal("(waiting…)");
  onMount(() => { msg.set("onMount fired ✓"); });
  return html\`<p>\${() => msg()}</p>\`;
});
mount(App, host, {});`,
      view: html`<span class="demo-out">${() => mounted()}</span>`,
      note: "onMount runs once the nodes are in the DOM and may return a cleanup, disposed on unmount.",
    })}
    ${example({
      title: "Router (createRouter)",
      code: `const router = createRouter([
  { path: "/", component: Home },
  { path: "/users/:id", load: () => import("./User.ts") },
  { path: "/admin", component: Admin, guard: ctx => isUX() || "/" },
], { fallback: "/" });
router.outlet(document.getElementById("app"));`,
      note: "History-API routing, params, lazy (code-split) routes, and UX-only guards — this very site swaps pages by re-mounting a component per selection.",
    })}
  `;
});

// --- ui --------------------------------------------------------------------
interface Row { id: string; name: string; plan: string; mrr: number; status: "Active" | "Trial" | "Churned"; }
const ROWS: Row[] = Array.from({ length: 7 }, (_, i) => ({
  id: `r${i}`,
  name: ["Acme", "Globex", "Initech", "Umbrella", "Stark", "Wayne", "Hooli"][i]!,
  plan: i % 2 ? "Team" : "Solo",
  mrr: 49 + i * 37,
  status: (["Active", "Trial", "Churned"] as const)[i % 3]!,
}));
const UiPage = component(() => html`
  ${head("@dxjs/ui", "A styled, CSP-safe component kit: appShell, statGrid, card, pill, and a sortable/searchable/paginated dataTable. Classes only — the look lives in ui.css.")}
  ${example({
    title: "statGrid",
    code: `statGrid([
  { label: "MRR", value: "$62,350", delta: "+12.4%", tone: "pos" },
  { label: "Churn", value: "2.1%", delta: "-0.3%", tone: "pos" },
  { label: "Trials", value: "89", delta: "12 this week", tone: "mut" },
])`,
    view: statGrid([
      { label: "MRR", value: "$62,350", delta: "+12.4%", tone: "pos" },
      { label: "Churn", value: "2.1%", delta: "-0.3%", tone: "pos" },
      { label: "Trials", value: "89", delta: "12 this week", tone: "mut" },
    ]),
  })}
  ${example({
    title: "dataTable (sort · search · paginate)",
    code: `dataTable({
  title: "Companies",
  columns: [
    { key: "name", label: "Company", sortable: true },
    { key: "mrr", label: "MRR", numeric: true, sortable: true,
      value: r => r.mrr, render: r => "$" + r.mrr },
    { key: "status", label: "Status",
      render: r => pill(r.status, tone(r.status)) },
  ],
  rows, rowKey: r => r.id, pageSize: 5,
})`,
    view: dataTable<Row>({
      columns: [
        { key: "name", label: "Company", sortable: true },
        { key: "mrr", label: "MRR", numeric: true, sortable: true, value: (r) => r.mrr, render: (r) => `$${r.mrr}` },
        { key: "status", label: "Status", render: (r) => pill(r.status, r.status === "Active" ? "pos" : r.status === "Trial" ? "mut" : "neg") },
      ],
      rows: ROWS,
      rowKey: (r) => r.id,
      pageSize: 5,
    }),
  })}
`);

// --- charts ----------------------------------------------------------------
const ChartsPage = component(() => html`
  ${head("@dxjs/charts", "CSP-safe charts: a thin, signal-reactive wrapper over Chart.js (bar/line/pie/doughnut) rendered to <canvas>. Opt-in bundle (bundles Chart.js).")}
  ${example({
    title: "A doughnut",
    code: `chart({
  kind: "doughnut",
  labels: ["Active", "Trial", "Past due", "Canceled"],
  series: [{ label: "Status", data: [62, 18, 7, 13] }],
})`,
    view: chart({
      kind: "doughnut",
      labels: ["Active", "Trial", "Past due", "Canceled"],
      series: [{ label: "Status", data: [62, 18, 7, 13] }],
      options: { animate: false },
    }),
  })}
  ${example({
    title: "A multi-series line",
    code: `chart({
  kind: "line",
  labels: ["Jan","Feb","Mar","Apr","May","Jun"],
  series: [
    { label: "Signups", data: [30,45,38,62,70,95] },
    { label: "Churn",   data: [5,8,6,9,7,11] },
  ],
})`,
    view: chart({
      kind: "line",
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
      series: [
        { label: "Signups", data: [30, 45, 38, 62, 70, 95] },
        { label: "Churn", data: [5, 8, 6, 9, 7, 11] },
      ],
      options: { animate: false },
    }),
    note: "Pass an accessor (() => spec) to make the chart update reactively when a signal changes.",
  })}
`);

// --- server ----------------------------------------------------------------
const ServerPage = component(() => {
  const out = renderToString(html`<section><h1>${() => "Hello"}</h1><p>SSR, DOM-free.</p></section>`);
  return html`
    ${head("@dxjs/server", "DOM-free SSR: renderToString produces HTML on the server; hydrate wires fine-grained reactivity onto the server markup in the browser.")}
    ${example({
      title: "renderToString — live output",
      code: `renderToString(
  html\`<section><h1>\${() => "Hello"}</h1>
    <p>SSR, DOM-free.</p></section>\`
)`,
      view: html`<pre class="ex-code ex-ssr">${out}</pre>`,
      note: "The string above was produced by renderToString running right now in your browser (no DOM needed).",
    })}
  `;
});

// --- transport / edge / canvas (reference) ---------------------------------
const TransportPage = component(() => html`
  ${head("@dxjs/transport", "A typed Client over fetch: REST, a cancel-on-unmount resource, multiplexed SSE, and Connect/gRPC.")}
  ${example({
    title: "REST client + reactive resource",
    code: `const api = createClient({ baseUrl: "/v1" });
const user = resource(sig => api.get("/me", { signal: sig }));
html\`<p>\${() => user.loading() ? "…" : user()?.name}</p>\``,
    note: "resource re-runs when a signal it reads changes, aborting the previous request; it aborts on unmount.",
  })}
  ${example({
    title: "Live updates over one SSE connection",
    code: `const live = createLiveSource("/events");
const ticks = live.topic("ticks");   // many topics, one connection
effect(() => render(ticks()));        // push → signal → surgical patch`,
    note: "One shared, multiplexed connection; the server pushes only deltas.",
  })}
`);
const CanvasPage = component(() => html`
  ${head("@dxjs/canvas", "A reactive node-graph on Canvas-2D: model + geometry + renderer + drag/connect/pan/zoom — for pipelines and architecture diagrams (the dxjs answer to react-flow).")}
  ${example({
    title: "Create a graph",
    code: `const g = createGraph();
g.addNode({ id: "src", x: 40, y: 40, title: "Source" });
g.addNode({ id: "xf",  x: 240, y: 120, title: "Transform" });
g.connect("src", "xf");
effect(() => draw(ctx, g, viewport()));   // signal → redraw`,
    note: "See e2e/csp/canvas for a full interactive proof under strict CSP.",
  })}
`);

// --- parity ----------------------------------------------------------------
const ParityPage = component(() => html`
  ${head("dxjs vs React", "Can dxjs deliver what React delivers — enough to rewrite the delonix-console?")}
  ${p("Short answer: for that console it is viable. The core (reactivity, DOM, components, router, SSR, transport, node-graph, charts) is covered, at ~16× smaller bundles and under a strict CSP React can't meet without eval/unsafe-inline.")}
  ${h2("Covered")}
  ${p("signals ↔ useState/zustand · computed/effect ↔ useMemo/useEffect · html ↔ JSX · component/onMount ↔ hooks · createRouter ↔ react-router (basics) · renderToString/hydrate ↔ SSR · transport REST/SSE/gRPC · @dxjs/canvas ↔ @xyflow/react · @dxjs/ui · @dxjs/charts. And zod, i18next, xterm, dexie work as-is (framework-agnostic).")}
  ${h2("Gaps to close before migrating (prioritised)")}
  ${p("1. a query/cache layer over resource (↔ react-query) · 2. list virtualization (↔ react-virtual) · 3. a forms helper (fields + zod) · 4. onError (error boundaries) · 5. createContext (DI; a module-scoped signal covers the immediate need).")}
  ${p("Full write-up: docs/parity/react-parity.md.")}
`);

export const pages: Page[] = [
  { id: "start", label: "Getting started", group: "Guide", view: GettingStarted },
  { id: "core", label: "@dxjs/core", group: "Packages", view: CorePage },
  { id: "dom", label: "@dxjs/dom", group: "Packages", view: DomPage },
  { id: "component", label: "@dxjs/component", group: "Packages", view: ComponentPage },
  { id: "ui", label: "@dxjs/ui", group: "Packages", view: UiPage },
  { id: "charts", label: "@dxjs/charts", group: "Packages", view: ChartsPage },
  { id: "transport", label: "@dxjs/transport", group: "Packages", view: TransportPage },
  { id: "server", label: "@dxjs/server", group: "Packages", view: ServerPage },
  { id: "canvas", label: "@dxjs/canvas", group: "Packages", view: CanvasPage },
  { id: "parity", label: "dxjs vs React", group: "Guide", view: ParityPage },
];
