// The documentation pages — each a dxjs component. The live examples use the real
// primitives (dogfooding): what you read in the code pane is what renders beside it.
import { signal, computed, effect, createContext, provide, inject, onError } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { component, onMount, type Component } from "@dxjs/component";
import { statGrid, dataTable, pill, virtualList } from "@dxjs/ui";
import { chart } from "@dxjs/charts";
import { createQueryClient, query } from "@dxjs/query";
import { createForm } from "@dxjs/forms";
import { renderToString } from "@dxjs/server";
import { example, runnable, p, h2 } from "./example.ts";
import { learnPages } from "./learn.ts";
import { LandingPage } from "./landing.ts";
import { GalleryPage } from "./gallery.ts";

export interface Page {
  id: string;
  label: string;
  /** Optional i18n key; when set, the sidebar label is translated. */
  labelKey?: string;
  group: string;
  view: Component;
}

const head = (title: string, lead: string): TemplateResult =>
  html`<h1 class="doc-h1">${title}</h1><p class="doc-lead">${lead}</p>`;

// --- Getting started -------------------------------------------------------
const GettingStarted = component(() => html`
  ${head("Getting started", "dxjs runs vanilla in the browser (no build) AND in Node (native TypeScript). Every example below is a COMPLETE file with its full path — copy the Browser tab or the Node tab and run it as-is.")}

  ${h2("Hello, reactive — the same counter, two ways")}
  ${runnable({
    title: "A reactive counter",
    browser: {
      path: "my-app/index.html",
      code: `<!doctype html>
<!-- Open this file directly in a browser. No bundler, no build step. -->
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>dxjs counter</title>
</head>
<body>
  <div id="app"></div>
  <script type="module">
    // cdn/dxjs.js = core+dom+component+ui, ~4.5 KB gzip, same-origin.
    import { signal, html, component, mount } from "./dxjs.js";

    const Counter = component(() => {
      const n = signal(0);
      return html\`<button @click=\${() => n.update(x => x + 1)}>
        n = \${() => n()}
      </button>\`;
    });

    mount(Counter, document.getElementById("app"), {});
  </script>
</body>
</html>`,
    },
    node: {
      path: "my-app/counter.ts",
      code: `// Run with: node counter.ts   (Node >= 22, native TypeScript — no transpile)
// dxjs renders to a DOM; on the server we render to a STRING instead.
import { signal } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { renderToString } from "@dxjs/server";

// Build the same view and snapshot it to HTML (DOM-free SSR).
const n = signal(41);
const view = html\`<button>n = \${() => n()}</button>\`;

console.log(renderToString(view));
// → <button>n = 41</button>
n.set(42); // signals drive updates; in the browser this patches the DOM in place`,
    },
    note: "The browser gets the single-file bundle (cdn/dxjs.js); Node runs the TypeScript source directly. Same signals, same html`` — one renders to the DOM, the other to a string.",
  })}

  ${h2("Keep @dxjs/* specifiers in the browser via an import map")}
  ${runnable({
    title: "Import map (browser) vs workspace install (Node)",
    browser: {
      path: "my-app/index.html",
      code: `<!doctype html>
<div id="app"></div>
<!-- Map the bare @dxjs/* specifiers to the single-file bundle. -->
<script type="importmap">
{ "imports": {
  "@dxjs/core": "./dxjs.js",
  "@dxjs/dom": "./dxjs.js",
  "@dxjs/component": "./dxjs.js",
  "@dxjs/ui": "./dxjs.js"
} }
</script>
<script type="module">
  import { signal } from "@dxjs/core";      // resolves to ./dxjs.js
  import { html }   from "@dxjs/dom";
  import { component, mount } from "@dxjs/component";

  const App = component(() => {
    const name = signal("Angola");
    return html\`<input @input=\${e => name.set(e.target.value)} />
      <p>Olá, \${() => name()}!</p>\`;
  });
  mount(App, document.getElementById("app"), {});
</script>`,
    },
    node: {
      path: "my-app/package.json",
      code: `{
  "name": "my-app",
  "type": "module",
  "dependencies": {
    "@dxjs/core": "^1.0.0",
    "@dxjs/dom": "^1.0.0",
    "@dxjs/component": "^1.0.0",
    "@dxjs/ui": "^1.0.0"
  },
  "scripts": {
    "start": "node --conditions=development src/main.ts"
  }
}
// $ npm install        # links @dxjs/* into node_modules
// $ npm start          # Node runs the .ts directly — no build`,
    },
    note: "In the browser an import map keeps the nice @dxjs/* names while loading one file. In Node the same names resolve through node_modules — no bundler either way.",
  })}

  ${h2("Add the component kit (@dxjs/ui)")}
  ${runnable({
    title: "A dashboard shell + stat grid",
    browser: {
      path: "my-app/dashboard.html",
      code: `<!doctype html>
<head>
  <!-- the kit's look is served same-origin (style-src 'self') -->
  <link rel="stylesheet" href="./ui.css" />
</head>
<body>
  <div id="app"></div>
  <script type="module">
    import { html, component, mount } from "./dxjs.js";
    import { statGrid, card } from "./dxjs.js";   // @dxjs/ui is in the bundle

    const Dash = component(() => html\`
      \${statGrid([
        { label: "MRR", value: "$62,350", delta: "+12.4%", tone: "pos" },
        { label: "Churn", value: "2.1%", delta: "-0.3%", tone: "pos" },
      ])}
      \${card({ title: "Welcome", body: html\`<p>Build the console.</p>\` })}
    \`);
    mount(Dash, document.getElementById("app"), {});
  </script>
</body>`,
    },
    node: {
      path: "my-app/src/main.ts",
      code: `// Node / bundler entry — identical imports, identical components.
import { html, component, mount } from "@dxjs/component";
import { statGrid, card } from "@dxjs/ui";

export const Dash = component(() => html\`
  \${statGrid([
    { label: "MRR", value: "$62,350", delta: "+12.4%", tone: "pos" },
    { label: "Churn", value: "2.1%", delta: "-0.3%", tone: "pos" },
  ])}
  \${card({ title: "Welcome", body: html\`<p>Build the console.</p>\` })}
\`);

// In a browser build:  mount(Dash, document.getElementById("app"), {});
// On the server:       renderToString(Dash({}))  // DOM-free SSR`,
    },
    note: "Link ui.css once (same-origin, CSP-safe). The components only toggle classes — the look lives in the stylesheet, so there are no inline styles to violate style-src.",
  })}

  ${h2("Security — the premise")}
  ${p("Every example on this site runs under a strict Content-Security-Policy (default-src 'none'; script-src 'self'; style-src 'self') — no eval, no inline handlers, output escaped by default. That is the premise dxjs is built on, in the browser and in Node alike.")}
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
const DemoTheme = createContext("light");
const ComponentPage = component(() => {
  const mounted = signal("(waiting…)");
  onMount(() => {
    mounted.set("onMount fired ✓");
    return () => {};
  });

  // Context (DI by construction scope): provide during construction, inject reads it.
  let themed = "light";
  provide(DemoTheme, "dark", () => {
    themed = inject(DemoTheme);
  });

  // Error boundary: register onError BEFORE the guarded work; a thrown effect is caught.
  const status = signal("running ✓");
  onError((e) => status.set("boundary caught: " + (e as Error).message));
  const trigger = signal(0);
  effect(() => {
    if (trigger() > 0) throw new Error("render failed");
  });

  return html`
    ${head("@dxjs/component", "Function components that run once; mount/onMount/onCleanup; onError error boundaries; createContext DI; and a History-API router.")}
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
    ${example({
      title: "createContext / provide / inject (DI)",
      code: `const Theme = createContext("light");
provide(Theme, "dark", () => {
  const t = inject(Theme);   // "dark" during construction
});`,
      view: html`<span class="demo-out">inject(Theme) = <b class="badge">${themed}</b></span>`,
      note: "Read at the top of a component (like useContext) and close over the value.",
    })}
    ${example({
      title: "onError (error boundary)",
      code: `onError(e => status.set("caught: " + e.message));
effect(() => { if (trigger() > 0) throw new Error("render failed"); });
// clicking re-runs the effect → it throws → the boundary catches it`,
      view: html`<div class="demo-row">
        <button class="demo-btn" @click=${() => trigger.update((x) => x + 1)}>Trigger error</button>
        <span class="demo-out">${() => status()}</span>
      </div>`,
      note: "Errors thrown by descendant effects/computeds propagate to the nearest onError; register it before the work it guards.",
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
  ${example({
    title: "virtualList — 10,000 rows, a handful of DOM nodes",
    code: `virtualList({
  rows: bigArray,        // 10,000 items
  rowHeight: 36, height: 300,
  key: (_, i) => i,
  render: (row, i) => html\`#\${i} — \${row}\`,
})`,
    view: virtualList<string>({
      rows: Array.from({ length: 10000 }, (_, i) => `item ${i}`),
      rowHeight: 36,
      height: 300,
      key: (_, i) => i,
      render: (row, i) => html`<span class="demo-out">#${i} — ${row}</span>`,
    }),
    note: "Scroll it: only the visible window (+overscan) is ever in the DOM. Sizing is applied via the CSSOM, so it stays CSP-clean.",
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

// --- query -----------------------------------------------------------------
const QueryPage = component(() => {
  const client = createQueryClient();
  let hits = 0;
  // A fake async "server": counts fetches so cache/dedupe is visible.
  const q = query(client, ["profile"], async () => {
    hits++;
    await new Promise((r) => setTimeout(r, 120));
    return `loaded #${hits}`;
  }, { staleTime: Infinity });
  return html`
    ${head("@dxjs/query", "Cached, deduped, stale-while-revalidate async queries with key invalidation — the signal-reactive answer to react-query.")}
    ${example({
      title: "query() — cache + refetch + invalidate",
      code: `const client = createQueryClient();
const q = query(client, ["profile"], fetchProfile,
  { staleTime: Infinity });
// q.data() · q.isLoading() · q.isFetching() · q.refetch()
client.invalidate(["profile"]);   // refetch live observers`,
      view: html`<div class="demo-row">
        <span class="demo-out">${() => (q.isFetching() ? "fetching…" : (q.data() ?? "—"))}</span>
        <button class="demo-btn" @click=${() => void q.refetch()}>refetch</button>
        <button class="demo-btn" @click=${() => void client.invalidate(["profile"])}>invalidate</button>
      </div>`,
      note: "Fetcher-agnostic: pass any () => Promise. Concurrent queries for one key share a single request; cached data shows immediately while a background refetch runs.",
    })}
  `;
});

// --- forms -----------------------------------------------------------------
interface Signup extends Record<string, unknown> { email: string; password: string; }
const FormsPage = component(() => {
  const result = signal("(not submitted)");
  const f = createForm<Signup>({
    initial: { email: "", password: "" },
    validate: (v) => {
      const e: Partial<Record<keyof Signup, string>> = {};
      if (!v.email.includes("@")) e.email = "enter a valid email";
      if (v.password.length < 6) e.password = "min 6 characters";
      return e;
    },
  });
  const submit = f.handleSubmit((v) => result.set("submitted: " + v.email));
  const emailFld = f.field("email");
  const passFld = f.field("password");
  return html`
    ${head("@dxjs/forms", "Signal-reactive forms: values, touched/dirty/error, submit, and a zod-compatible validator — the dxjs answer to react-hook-form.")}
    ${example({
      title: "createForm() — validated login",
      code: `const f = createForm({ initial: { email: "", password: "" },
  validate: zodValidate(LoginSchema) });  // or a plain fn
const submit = f.handleSubmit(v => save(v));
html\`<input @input=\${f.field("email").onInput}
  @blur=\${f.field("email").onBlur} />\``,
      view: html`<form class="demo-form" @submit=${submit}>
        <div class="demo-row">
          <input class="demo-input" placeholder="email"
            @input=${emailFld.onInput} @blur=${emailFld.onBlur} />
          <span class="demo-out">${() => (f.touched("email")() && f.error("email")()) || ""}</span>
        </div>
        <div class="demo-row">
          <input class="demo-input" type="password" placeholder="password"
            @input=${passFld.onInput} @blur=${passFld.onBlur} />
          <span class="demo-out">${() => (f.touched("password")() && f.error("password")()) || ""}</span>
        </div>
        <div class="demo-row">
          <button class="demo-btn" type="submit" ?disabled=${() => !f.isValid()}>Sign up</button>
          <span class="demo-out">${() => result()}</span>
        </div>
      </form>`,
      note: "errors/isValid/dirty are computeds over the field signals; validate with a plain function or adapt a zod schema via zodValidate (no zod dependency).",
    })}
  `;
});

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
  ${h2("The gaps — now built ✓")}
  ${p("1. ✓ @dxjs/query (cache/dedupe/SWR/invalidate ↔ react-query) · 2. ✓ virtualList in @dxjs/ui (↔ react-virtual) · 3. ✓ @dxjs/forms (fields + zodValidate) · 4. ✓ onError error boundaries (@dxjs/core) · 5. ✓ createContext/provide/inject (@dxjs/core).")}
  ${p("Now also built: nested routes with shared layouts + typed loaders (createRouter + Outlet). Still optional: signals DevTools, defineElement — none blocks the migration. Full write-up: docs/parity/react-parity.md.")}
`);

// --- Migration -------------------------------------------------------------
const mapRow = (from: string, to: string, note: string): TemplateResult =>
  html`<tr><td><code>${from}</code></td><td><code>${to}</code></td><td>${note}</td></tr>`;
const mapTable = (caption: string, rows: TemplateResult[]): TemplateResult => html`
  <table class="dx-tbl doc-map" aria-label=${caption}>
    <thead><tr><th>From</th><th>dxjs</th><th>Notes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;

const MigrationPage = component(() => html`
  ${head("Migration", "Coming from React or Angular? Here is the concept-for-concept map — and what changes in your head.")}
  ${p("dxjs is fine-grained reactive: components run ONCE to build their view, and signals (not re-renders) drive updates. There is no VDOM, no dependency arrays, no change detection. That removes most of the footguns you carry from React/Angular.")}

  ${h2("From React")}
  ${mapTable("React to dxjs", [
    mapRow("useState", "signal", "A getter/setter you call; reads inside a binding subscribe automatically."),
    mapRow("useMemo", "computed", "Memoised derived value; no dependency array — tracked automatically."),
    mapRow("useEffect", "effect", "Runs on tracked-dependency change; return a cleanup. No deps array."),
    mapRow("JSX / createElement", "html`` or @dxjs/jsx", "Both compile to the SAME safe sinks; no eval, strict-CSP safe."),
    mapRow("useContext", "inject(ctx)", "Read at construction; provide() wraps children synchronously."),
    mapRow("ErrorBoundary", "onError / errorBoundary", "Client (onError) and SSR (errorBoundary) boundaries."),
    mapRow("Suspense", "suspense()", "SSR streaming boundary (see Recipes)."),
    mapRow("react-router", "createRouter + Outlet", "Nested routes, shared layouts, typed loaders."),
    mapRow("react-query", "@dxjs/query", "Cache, dedupe, SWR, invalidate."),
  ])}
  ${p("The big mental shift: do NOT lift state to re-render. Put it in a signal; the one binding that reads it updates. A component body is a constructor, not a render function — it does not re-run.")}

  ${h2("From Angular")}
  ${mapTable("Angular to dxjs", [
    mapRow("@Component template", "component(() => html``)", "A function returning a view; no decorators, no NgModules."),
    mapRow("signal() / computed()", "signal() / computed()", "Same idea; no zone.js — updates are surgical, not change-detection sweeps."),
    mapRow("@Input", "props argument", "Plain function parameter; pass accessors for reactive inputs."),
    mapRow("@Output / EventEmitter", "callback props / @event", "Pass a function; bind with @event (addEventListener, never inline)."),
    mapRow("*ngFor", "list(items, key, render)", "Keyed; stable nodes across reorder."),
    mapRow("*ngIf", "() => cond ? a : b", "A reactive child accessor."),
    mapRow("RouterOutlet", "Outlet()", "Nested layouts preserve state across child navigation."),
    mapRow("DI providers", "createContext/provide/inject", "Construction-scoped DI, no hierarchical injector ceremony."),
  ])}

  ${h2("What you gain")}
  ${p("~16× smaller bundles, a strict CSP with zero eval/inline (impossible for React without unsafe-eval), deterministic teardown, and SSR that streams. What you give up: a vast ecosystem of React-specific components — but framework-agnostic libraries (zod, xterm, dexie, chart.js) work as-is.")}
`);

// --- Recipes ---------------------------------------------------------------
const RecipesPage = component(() => html`
  ${head("Recipes", "Task-focused snippets for the things you will actually build.")}

  ${h2("Nested routes with a shared layout + loader")}
  ${example({
    title: "A section layout that survives child navigation",
    code: `import { createRouter, Outlet } from "@dxjs/component";

const UsersLayout = component(() =>
  html\`<div class="section">
    <nav>…</nav>
    \${Outlet()}            // the active child mounts here
  </div>\`);

const r = createRouter([
  { path: "/users", component: UsersLayout, children: [
    { path: "",    component: UsersIndex },
    { path: ":id", component: UserDetail,
      loader: (c) => fetch(\`/api/users/\${c.params.id}\`).then(r => r.json()) },
  ]},
]);
r.outlet(document.getElementById("app"));

// In UserDetail the loaded data is reactive:
//   html\`<h1>\${() => c.data()?.name ?? "…"}</h1>\``,
    note: "Navigating /users/1 → /users/2 re-mounts ONLY the child; UsersLayout (and its signals) is preserved.",
  })}

  ${h2("i18n — Angolan Portuguese by default")}
  ${example({
    title: "@dxjs/i18n: reactive locale, Kwanza, Intl",
    code: `import { createI18n } from "@dxjs/i18n";

const i18n = createI18n({
  fallbackLocale: "pt-AO",
  messages: {
    "pt-AO": { greeting: "Olá, {name}!", nav: { users: "Utilizadores" } },
    "en-US": { greeting: "Hello, {name}!" },
  },
});

i18n.t("greeting", { name: "Ana" }); // "Olá, Ana!"
i18n.currency(1234.5);               // "1 234,50 Kz"  (AOA default)
i18n.n(1234567.89);                  // "1 234 567,89"

// Reactive: a binding that read t/n re-derives on setLocale().`,
    note: "Translation is dict lookup + {param} interpolation — no eval, strict-CSP safe.",
  })}

  ${h2("Streaming SSR with Suspense + error boundary")}
  ${example({
    title: "@dxjs/server: stream the shell, then async panels",
    code: `import { renderToStream, suspense, errorBoundary } from "@dxjs/server";

const page = html\`<main>
  <h1>Dashboard</h1>
  \${errorBoundary(
    suspense("loading…", async () => {
      const data = await getMetrics();   // slow
      return html\`<section>\${data.total}</section>\`;
    }),
    (err) => html\`<div class="err">\${String(err)}</div>\`,
  )}
</main>\`;

// A Web ReadableStream — edge-ready. The shell flushes first; the panel
// streams in document order when its data resolves. No inline script → CSP-safe.
return new Response(renderToStream(page), {
  headers: { "content-type": "text/html; charset=utf-8" },
});`,
    note: "A failing or slow panel never blanks the page: the boundary streams a fallback, atomically.",
  })}

  ${h2("Dev server with HMR")}
  ${example({
    title: "@dxjs/dev: signal-preserving hot reload under strict CSP",
    code: `# point the dev server at an entry module
npx dxdev src/main.ts --css app.css --port 5173

# edit a component's markup and save:
#  • the view re-renders WITHOUT a full reload
#  • a signal's value survives (store it in import.meta.hot.data)

const count = (import.meta.hot?.data.count ??= signal(0));
import.meta.hot?.accept();`,
    note: "HMR rides a long-poll channel (plain fetch → connect-src 'self'); the swap is a dynamic import() of a same-origin module — no eval, no inline.",
  })}
`);

export const pages: Page[] = [
  { id: "overview", label: "Overview", labelKey: "nav.overview", group: "Start", view: LandingPage },
  { id: "gallery", label: "Components", labelKey: "nav.gallery", group: "Start", view: GalleryPage },
  { id: "start", label: "Getting started", labelKey: "nav.start", group: "Guide", view: GettingStarted },
  ...learnPages,
  { id: "core", label: "@dxjs/core", group: "Packages", view: CorePage },
  { id: "dom", label: "@dxjs/dom", group: "Packages", view: DomPage },
  { id: "component", label: "@dxjs/component", group: "Packages", view: ComponentPage },
  { id: "ui", label: "@dxjs/ui", group: "Packages", view: UiPage },
  { id: "charts", label: "@dxjs/charts", group: "Packages", view: ChartsPage },
  { id: "query", label: "@dxjs/query", group: "Packages", view: QueryPage },
  { id: "forms", label: "@dxjs/forms", group: "Packages", view: FormsPage },
  { id: "transport", label: "@dxjs/transport", group: "Packages", view: TransportPage },
  { id: "server", label: "@dxjs/server", group: "Packages", view: ServerPage },
  { id: "canvas", label: "@dxjs/canvas", group: "Packages", view: CanvasPage },
  { id: "parity", label: "dxjs vs React", group: "Guide", view: ParityPage },
  { id: "migration", label: "Migration", group: "Guide", view: MigrationPage },
  { id: "recipes", label: "Recipes", group: "Guide", view: RecipesPage },
];
