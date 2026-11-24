// The LEARN track — a sequential, didactic path for the app developer. Where the
// Packages pages are reference, these read in order: philosophy → signals → a
// first app → components that scale → the backend → shipping behind nginx in a
// delonix container. Each page is itself a dxjs component (dogfooding): the live
// panes are rendered by the very primitives the prose teaches.
import { signal, computed, effect, onError } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { component } from "@dxjs/component";
import { example, p, h2 } from "./example.ts";
import type { Page } from "./pages.ts";

const head = (title: string, lead: string): TemplateResult =>
  html`<h1 class="doc-h1">${title}</h1><p class="doc-lead">${lead}</p>`;

// A plain prose list, for the "principles" / "checklist" blocks.
const ul = (items: string[]): TemplateResult =>
  html`<ul class="doc-ul">${items.map((t) => html`<li>${t}</li>`)}</ul>`;

// ===========================================================================
// 1 · Why dxjs — the mental model
// ===========================================================================
const WhyPage = component(() =>
  html`
    ${head(
      "1 · Why dxjs",
      "Before the first line of code: what problem dxjs solves, and the one idea everything else follows from.",
    )}
    ${p("dxjs is a fine-grained reactive UI engine. It has no Virtual DOM, no re-render cycle, and no build step in development. It was designed clean-room to run under a strict Content-Security-Policy — no eval, no inline handlers, output escaped by default — while staying tiny (a full reactive app is ~2.8 KB gzip, vs ~45 KB for React+ReactDOM).")}

    ${h2("The one idea: a component runs once")}
    ${p("A React component is a render function: it runs again on every state change, produces a new virtual tree, and the framework diffs that tree against the last one to find what to touch. dxjs does none of that. A dxjs component is a CONSTRUCTOR — it runs exactly once, builds the DOM, and wires each dynamic spot to a signal. When a signal changes, only the bindings that read it re-run. The update is surgical: one text node, one attribute, one list row — never a tree diff.")}
    ${example({
      title: "Read this slowly — the body never runs twice",
      code: `const Counter = component(() => {
  console.log("constructed");          // prints ONCE, ever
  const n = signal(0);
  return html\`
    <button @click=\${() => n.update(x => x + 1)}>+1</button>
    <span>n = \${() => n()}</span>      // only THIS re-runs on change
  \`;
});`,
      note: "There is no dependency array, no memo, no useCallback. The function wrapping n() is the subscription; dxjs tracks what it reads automatically.",
    })}

    ${h2("Why that matters — three properties you get for free")}
    ${p("The single idea above is why dxjs is, by construction:")}
    ${ul([
      "Fast — no VDOM allocation, no diffing, no reconciliation sweep. Work is proportional to what actually changed, not to the size of the tree. Large lists and live dashboards stay smooth because an incoming delta patches one node.",
      "Secure — html`` compiles once to a <template>; values go through safe sinks (textContent, setAttribute, .prop, @event via addEventListener). There is never a string→HTML path for data, never an inline on* handler, never eval. That is what lets it run under default-src 'none'; script-src 'self' with zero violations.",
      "Resilient — every component and effect owns a cleanup tree. On unmount, listeners are removed, effects stop, in-flight requests abort. No leaks, no stale responses overwriting fresh state, no setTimeout choreography.",
    ])}

    ${h2("What dxjs is NOT")}
    ${p("dxjs is not a React clone and does not aim to replicate its ecosystem, VDOM or Fiber. It does not do client-side authorization (authz is always the backend's job — the router and visibility are UX only). And it does not force a build step in development: native ESM runs directly in the browser and Node runs the TypeScript as-is.")}
    ${p("Next: the primitive all of this rests on — the signal.")}
  `,
);

// ===========================================================================
// 2 · Thinking in signals
// ===========================================================================
const SignalsPage = component(() => {
  const price = signal(100);
  const qty = signal(2);
  const total = computed(() => price() * qty());
  return html`
    ${head(
      "2 · Thinking in signals",
      "Four primitives — signal, computed, effect, batch — and the single rule that keeps a value reactive.",
    )}
    ${p("A signal is a reactive cell: call it with no arguments to READ (and subscribe, if you are inside a tracking scope), call .set(v) or .update(fn) to WRITE. A computed is a derived read-only signal that recomputes only when something it read changed. An effect runs a side-effect and re-runs on change. That is the whole model.")}
    ${example({
      title: "signal · computed · effect",
      code: `const price = signal(100);
const qty   = signal(2);
const total = computed(() => price() * qty());  // derived, cached

effect(() => console.log("total:", total()));   // logs 200, then on change

qty.set(3);     // effect re-runs → "total: 300"
price.update(p => p + 10);  // → "total: 330"`,
      view: html`<div class="demo-row">
        <button class="demo-btn" @click=${() => qty.update((x) => x + 1)}>qty +1</button>
        <button class="demo-btn" @click=${() => price.update((x) => x + 10)}>price +10</button>
        <span class="demo-out">${() => `${price()} × ${qty()} = ${total()}`}</span>
      </div>`,
      note: "total never stores anything you set; it is defined by its formula and stays correct automatically.",
    })}

    ${h2("The one rule: keep the read lazy")}
    ${p("A binding is reactive because it is a FUNCTION that reads a signal. Pass the function, not the value. A () => n() binding re-runs when n changes; an n() binding reads once at construction and freezes. This is the single mistake newcomers make — when something does not update, you forgot the arrow.")}
    ${example({
      title: "Reactive vs frozen",
      code: `html\`<span>live:   \${() => n()}</span>\`   // ✅ updates
html\`<span>frozen: \${n()}</span>\`         // ❌ reads once\``,
      note: "Same rule everywhere: attributes, classes, children — wrap the reactive expression in () =>.",
    })}

    ${h2("batch, untrack, and the owner tree")}
    ${ul([
      "batch(fn) — coalesce several writes into one flush, so dependents recompute once, not once per write.",
      "untrack(fn) — read a signal WITHOUT subscribing to it (use it when a computed needs a value but should not re-run when that value changes).",
      "onCleanup(fn) — register teardown; it runs when the owning component/effect is disposed. This is how subscriptions and timers get released deterministically.",
      "createRoot(fn) — an owned reactive scope with explicit disposal, for state that lives outside any component (a store).",
    ])}
    ${p("Every effect and component has an OWNER. Dispose the owner (unmount the component) and its whole subtree of effects, listeners and cleanups is torn down in order. You rarely call this by hand — mount()/the router do it — but it is why dxjs does not leak.")}
    ${p("Next: put these four primitives together into a real, growing app.")}
  `;
});

// ===========================================================================
// 3 · Your first app, step by step
// ===========================================================================
const FirstAppPage = component(() => {
  // Step 3 live: a tiny todo built from exactly the primitives shown.
  const draft = signal("");
  const items = signal<{ id: number; text: string }[]>([
    { id: 1, text: "Read ‘Why dxjs’" },
    { id: 2, text: "Write a signal" },
  ]);
  let seq = 2;
  const add = (): void => {
    const t = draft().trim();
    if (!t) return;
    items.update((xs) => [...xs, { id: ++seq, text: t }]);
    draft.set("");
  };
  const remove = (id: number): void => {
    items.update((xs) => xs.filter((x) => x.id !== id));
  };
  const left = computed(() => items().length);
  return html`
    ${head(
      "3 · Your first app, step by step",
      "From a counter to a working todo list — building up one primitive at a time.",
    )}

    ${h2("Step 1 — mount something")}
    ${p("mount(Component, host, props) attaches a component to a DOM node and returns a dispose function. In the browser you point it at a real element; that is the entire bootstrap.")}
    ${example({
      title: "The smallest app",
      code: `import { signal } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { component, mount } from "@dxjs/component";

const Hello = component(() => html\`<h1>Olá, dxjs!</h1>\`);
const dispose = mount(Hello, document.getElementById("app"), {});
// call dispose() to tear it all down (tests, HMR, route change).`,
    })}

    ${h2("Step 2 — add reactive state")}
    ${p("Put mutable state in a signal; read it lazily in the view. The button handler is bound with @click — addEventListener under the hood, never an inline attribute, so it works under strict CSP.")}
    ${example({
      title: "A counter",
      code: `const Counter = component(() => {
  const n = signal(0);
  return html\`
    <button @click=\${() => n.update(x => x + 1)}>+1</button>
    <output>\${() => n()}</output>\`;
});`,
    })}

    ${h2("Step 3 — input, a keyed list, and derived state")}
    ${p("Now a real todo: an input bound to a draft signal, a keyed list() so rows keep their identity across inserts and removals, and a computed count. The pane on the right is live — add and remove items.")}
    ${example({
      title: "A working todo (this very panel)",
      code: `const draft = signal("");
const items = signal([{ id: 1, text: "…" }]);
const add = () => {
  const t = draft().trim(); if (!t) return;
  items.update(xs => [...xs, { id: ++seq, text: t }]);
  draft.set("");
};
html\`
  <form @submit=\${(e) => { e.preventDefault(); add(); }}>
    <input .value=\${() => draft()}
           @input=\${(e) => draft.set(e.target.value)} />
    <button>Add</button>
  </form>
  <ul>\${list(() => items(), it => it.id, it => html\`
    <li>\${it.text}
      <button @click=\${() => remove(it.id)}>×</button>
    </li>\`)}</ul>
  <small>\${() => left()} left</small>\``,
      view: html`<div class="demo-col">
        <form
          class="demo-row"
          @submit=${(e: Event) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            class="demo-input"
            placeholder="New task…"
            .value=${() => draft()}
            @input=${(e: Event) => draft.set((e.target as HTMLInputElement).value)}
          />
          <button class="demo-btn">Add</button>
        </form>
        <ul>
          ${list(
            () => items(),
            (it) => it.id,
            (it) =>
              html`<li class="demo-out">
                ${it.text}
                <button class="demo-btn" @click=${() => remove(it.id)}>×</button>
              </li>`,
          )}
        </ul>
        <small class="ex-note">${() => left()} left</small>
      </div>`,
      note: "list(source, key, render) keyes by id: adding one task appends one <li>; removing one deletes one node. No list is rebuilt, no row loses focus.",
    })}
    ${p("You now have the full loop: state → view → event → state. Everything else is scaling this pattern. Next: how to shape it so it survives a large codebase.")}
  `;
});

// ===========================================================================
// 4 · Components that scale
// ===========================================================================
const ScalePage = component(() => {
  // A live error boundary demo. onError does NOT return a view — it is notified
  // of the error; here it records it in a signal the display binding reads.
  const boom = signal(false);
  const Risky = component(() => {
    const status = signal("healthy");
    onError((e) => status.set(`caught: ${String(e)}`));
    // A descendant effect that throws when the switch flips; the boundary above
    // catches it and updates `status` — the display binding is independent.
    effect(() => {
      if (boom()) throw new Error("render failed");
    });
    return html`<span class="demo-out">${() => status()}</span>`;
  });
  return html`
    ${head(
      "4 · Components that scale",
      "Designing for performance, resilience and reuse — the patterns that hold a high-complexity system together.",
    )}

    ${h2("Reuse — props are accessors, not values")}
    ${p("A reusable component should not read a fixed value; it should accept an ACCESSOR (a function) so the caller can feed it reactive data. Outputs are callback props. No two-way binding, no event-emitter ceremony — a function in, a function out.")}
    ${example({
      title: "A reusable, reactive component",
      code: `// props.count is an accessor; props.onPick is a callback
const Badge = component((props: {
  count: () => number;
  onPick: (n: number) => void;
}) => html\`
  <button @click=\${() => props.onPick(props.count())}>
    picked \${() => props.count()}
  </button>\`);

// caller wires its own signal in; Badge never owns the state
html\`\${Badge({ count: () => total(), onPick: pick })}\``,
      note: "Because the body runs once, pass () => signal() — not signal() — or the child freezes at construction.",
    })}

    ${h2("Performance — the four levers")}
    ${ul([
      "computed() for derived values — it caches and only recomputes when an input changed; never recompute inline in a hot binding.",
      "list(source, key, render) for collections — keyed reconciliation moves/inserts/removes nodes instead of rebuilding. Always give a stable key.",
      "batch() around multi-field updates — one flush instead of one per write, so a form of 20 fields does not trigger 20 recomputes.",
      "virtualList (@dxjs/ui) for thousands of rows — render only the visible window; the DOM stays small no matter the dataset.",
    ])}
    ${p("The default is already fast: there is no re-render to optimise away. These levers matter at the extremes — big lists, high-frequency live data, wide forms.")}

    ${h2("Resilience — contain failure with onError")}
    ${p("onError(handler) installs an error boundary on the owner scope: when a descendant effect or computed throws, the error propagates up the owner tree to the nearest handler (run untracked) instead of taking down the page. The handler is NOTIFIED of the error — it does not return a fallback view. The idiom is: record it in a signal and let the display binding render the fallback. Pair this with resource/query retries (next page) so a flaky backend degrades gracefully rather than blanking the UI.")}
    ${example({
      title: "An error boundary (live — flip the switch)",
      code: `const Risky = component(() => {
  const status = signal("healthy");
  onError(e => status.set("caught: " + String(e)));  // notified, not a view
  effect(() => { if (boom()) throw new Error("render failed"); });
  return html\`<span>\${() => status()}</span>\`;        // display reads the signal
});`,
      view: html`<div class="demo-row">
        <button class="demo-btn" @click=${() => boom.update((x) => !x)}>
          toggle failure
        </button>
        ${Risky({})}
      </div>`,
      note: "The boundary catches the throw and swaps in a fallback; the rest of the app keeps running.",
    })}

    ${h2("Cross-cutting state — context, not prop-drilling")}
    ${p("For things every feature needs — the API client, the current tenant, the theme — use createContext + provide/inject. provide() wraps a subtree synchronously at construction; inject(ctx) reads the nearest provided value. It is dependency injection scoped by the owner tree, with no hierarchical-injector ceremony.")}
    ${example({
      title: "Provide once, inject anywhere below",
      code: `import { createContext, provide, inject } from "@dxjs/core";

const ApiCtx = createContext<Client>();

// at the root:
provide(ApiCtx, createClient({ baseUrl: "/v1" }), () => mount(App, host, {}));

// in any descendant component:
const api = inject(ApiCtx);
const me = resource(sig => api.get("/me", { signal: sig }));`,
    })}

    ${h2("Structuring a large app")}
    ${ul([
      "One feature = one folder: its components, its signals (a small store via createRoot), its transport calls. Features depend on shared infrastructure (the API client, i18n), never on each other's internals.",
      "One live connection, many topics: a single createLiveSource feeds every real-time widget via .topic() — do not open a socket per component (see page 5).",
      "Route-level code-splitting: the router imports each route with import()+SRI, so a feature's code ships only when visited.",
      "Push authz to the backend: hide UI for UX, but never trust the client — every mutating call is authorized server-side.",
    ])}
    ${p("Next: where the data actually comes from.")}
  `;
});

// ===========================================================================
// 5 · Talking to a backend
// ===========================================================================
const BackendPage = component(() =>
  html`
    ${head(
      "5 · Talking to a backend",
      "REST, gRPC (Connect in the browser, native at the edge) and live SSE — all over one typed transport, cancel-on-unmount by construction.",
    )}

    ${h2("REST — a typed client + a reactive resource")}
    ${p("createClient gives you a typed fetch wrapper: a base URL, an auth-token provider sent only in the Authorization header, per-request query/headers, and typed errors (RFC 9457 Problem — err.status, err.body.title). resource() turns an async call into a reactive value with .loading(), .error() and .refetch(); it aborts the previous request when its inputs change and aborts on unmount, so stale responses never overwrite fresh state.")}
    ${example({
      title: "Client + resource, cancel-on-unmount",
      code: `import { createClient, resource } from "@dxjs/transport";

const api = createClient({
  baseUrl: "/v1",
  auth: () => token(),          // read from an in-memory store, never localStorage
});

const Profile = component((props: { id: () => string }) => {
  const user = resource(sig =>
    api.get(\`/users/\${props.id()}\`, { signal: sig }));
  return html\`
    \${() => user.loading() ? "loading…"
          : user.error() ? "failed"
          : user()?.name}\`;
});`,
      note: "resource reads props.id() inside its fetcher, so changing the id re-fetches and aborts the in-flight one. No useEffect, no cleanup to write.",
    })}

    ${h2("Resilience — timeout, retries, idempotency")}
    ${p("Every request (and resource) takes ResilienceOptions: timeout (per-attempt, aborts the fetch), retries (extra attempts on a transient 5xx/429/408), and backoff (exponential base). GET/PUT/DELETE retry by default; a POST retries only if you mark it idempotent: true (e.g. it carries an Idempotency-Key). This is retry you can reason about, not blind replay.")}
    ${example({
      title: "A call that tolerates a flaky network",
      code: `const items = resource(
  sig => api.get("/catalog", { signal: sig }),
  { timeout: 4000, retries: 2, backoff: 300 },  // waits 300ms, then 600ms
);

// a safe-to-replay mutation:
await api.post("/orders", body, { idempotent: true, retries: 2 });`,
    })}

    ${h2("gRPC — honest, by environment")}
    ${p("Browsers cannot speak native gRPC (no access to HTTP/2 trailers). dxjs is honest about this and picks the right transport for where the code runs — the component code is identical either way.")}
    ${ul([
      "In the browser → createConnectClient (@dxjs/transport): Connect / gRPC-Web over HTTP/1.1+2, unary and server-streaming, no proxy if your backend speaks Connect (a Rust/tonic service can expose it).",
      "In dxjs on the server/edge, co-located with the backend → createGrpcChannel (@dxjs/edge): true native gRPC over node:http2, reading trailers — full server-to-server calls.",
    ])}
    ${example({
      title: "Connect from the browser",
      code: `import { createConnectClient } from "@dxjs/transport";

const rpc = createConnectClient({ baseUrl: "/grpc" });
const res = await rpc.unary("catalog.v1.Catalog/List",
                            { page: 0 }, { signal });`,
      note: "Same shape as REST: a signal cancels it, errors are typed. Swap the transport, keep the component.",
    })}

    ${h2("Live updates — one SSE connection, many topics")}
    ${p("The real-time story is deliberate: ONE shared SSE connection per client, multiplexed by topic. A widget subscribes with .topic(name) and gets a signal fed by the server's deltas; on unmount it unsubscribes automatically. The server pushes only on change (event-driven, not polling) and sends deltas, not whole states, with Last-Event-ID to resume. Server load is one open connection plus bytes-on-change — exactly the ‘real-time without server load’ goal.")}
    ${example({
      title: "A live ticker",
      code: `import { createLiveSource } from "@dxjs/transport";

const live = createLiveSource("/events");   // one connection, app-wide

const Ticker = component(() => {
  const price = live.topic("ticker:AO-BONDS");  // a signal
  return html\`<span>\${() => fmt(price())}</span>\`;
});
// a second widget: live.topic("orders:new") — SAME connection.`,
      note: "Do not create a source per component. Make one at the root (or provide() it) and hand out topics.",
    })}

    ${h2("Caching across components — @dxjs/query")}
    ${p("When several components need the same data, wrap the call in @dxjs/query: it caches by key, dedupes concurrent requests, serves stale-while-revalidate, and lets you invalidate a key after a mutation. It is the react-query shape, signal-native.")}
    ${example({
      title: "Deduped, cached, invalidatable",
      code: `import { createQueryClient, query } from "@dxjs/query";
const qc = createQueryClient();

const users = query(qc, ["users"], sig => api.get("/users", { signal: sig }));
// users.data(), users.loading(), users.error() — reactive

await api.post("/users", body);
qc.invalidate(["users"]);   // every subscriber refetches once`,
    })}
    ${p("Next: build it for production and put it behind nginx, inside a delonix container.")}
  `,
);

// ===========================================================================
// 6 · Ship it — nginx inside a delonix container
// ===========================================================================
const codeBlock = (title: string, code: string, note?: string): TemplateResult =>
  example({ title, code, note });

const DeployPage = component(() =>
  html`
    ${head(
      "6 · Ship it — nginx + delonix",
      "Build the static bundle, let nginx serve it (and proxy the API), and run the whole thing in a delonix container.",
    )}

    ${h2("The shape of a dxjs deployment")}
    ${p("A dxjs app is static files: a minified, hashed ESM bundle plus CSS and index.html. Nothing runs ‘the frontend’ at runtime — nginx serves those files directly and proxies the dynamic paths (REST /v1, the Connect/gRPC endpoint, the SSE stream) to your backend API. dxjs does no server-side work unless you opt into SSR (@dxjs/server), so the static tier is cheap, cacheable and CDN-friendly.")}
    ${p("Topology: the browser talks to nginx (static + reverse proxy), and nginx talks to the backend API (REST / Connect / gRPC). nginx owns everything static; the API owns everything dynamic and all authorization.")}

    ${h2("Step 1 — build for production")}
    ${codeBlock(
      "Emit minified, hashed assets",
      `# dxjs itself ships a single-file bundle (no bundler needed):
node scripts/build.mjs        # → cdn/dxjs.js (~4.5 KB gzip)

# for an app, bundle your entry with esbuild (tree-shaken, hashed):
npx esbuild src/main.ts \\
  --bundle --minify --format=esm \\
  --target=es2021 --entry-names='[name].[hash]' \\
  --outdir=dist

# dist/ now holds main.<hash>.js + your CSS + index.html`,
      "Zero runtime dependencies and a size-budget gate mean the bundle is small and the hash lets nginx cache it forever.",
    )}

    ${h2("Step 2 — the nginx config")}
    ${p("Serve the static files, keep the SAME strict CSP dxjs is built for, proxy the API, and give SSE its own location (buffering OFF, long timeouts) so live updates stream instead of stalling.")}
    ${codeBlock(
      "nginx.conf — static + CSP + API proxy + SSE",
      `server {
  listen 80;
  root  /usr/share/nginx/html;        # the dist/ you built

  # The strict CSP dxjs is designed for — no eval, no inline.
  add_header Content-Security-Policy
    "default-src 'none'; script-src 'self'; style-src 'self'; \\
     img-src 'self' data:; connect-src 'self'; base-uri 'none'" always;

  gzip on;  gzip_types application/javascript text/css;

  # hashed assets never change → cache hard
  location ~* \\.[0-9a-f]{8,}\\.(js|css)$ {
    expires 1y; add_header Cache-Control "public, immutable";
  }

  # SPA fallback: unknown paths return index.html (client router takes over)
  location / { try_files $uri $uri/ /index.html; }

  # REST + Connect/gRPC-Web → backend
  location /v1/   { proxy_pass http://api:8080; }
  location /grpc/ { proxy_pass http://api:8080; }

  # SSE: no buffering, keep the stream open
  location /events {
    proxy_pass http://api:8080;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_buffering off;
    proxy_read_timeout 1h;
  }
}`,
      "connect-src 'self' is enough because nginx proxies the API under the same origin — the browser never makes a cross-origin request.",
    )}

    ${h2("Step 3 — the container image")}
    ${p("A two-stage build: compile the bundle, then copy only dist/ into a tiny nginx image. delonix builds and runs OCI images exactly like Docker — the Dockerfile is standard.")}
    ${codeBlock(
      "Dockerfile",
      `# ── build stage ──────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx esbuild src/main.ts --bundle --minify --format=esm \\
      --target=es2021 --entry-names='[name].[hash]' --outdir=dist \\
 && cp index.html dist/

# ── serve stage ──────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80`,
      "The final image carries no Node, no sources — just nginx and static files. Small surface, small size.",
    )}

    ${h2("Step 4 — build & run with delonix")}
    ${codeBlock(
      "delonix — same verbs as Docker",
      `# build the image
delonix build -t my-console:1.0 .

# run it, publishing port 80 inside to 8080 on the host
delonix run -d --name console -p 8080:80 my-console:1.0

# → the dxjs app is live at http://127.0.0.1:8080 under strict CSP`,
    )}

    ${h2("Step 5 — the app + the API together")}
    ${p("A compose file runs the nginx-static front and the backend API side by side on one network, so nginx reaches the API by its service name (http://api:8080, as in the config above).")}
    ${codeBlock(
      "compose.yaml",
      `services:
  console:                      # dxjs static, served by nginx
    build: .
    ports: ["8080:80"]
    depends_on: [api]
  api:                          # your backend (REST + Connect + SSE)
    image: my-backend:1.0
    expose: ["8080"]

# delonix compose up -d`,
      "nginx serves every static byte; the API serves /v1, /grpc and /events. One origin, strict CSP, no CORS.",
    )}

    ${h2("Optional — SSR / edge")}
    ${p("If you need server-rendered HTML (first-paint, SEO), @dxjs/server renders to a Web ReadableStream with the same escaping and emits the CSP hash that matches the client — and @dxjs/edge adapts it to Node/Workers/Deno. Then nginx proxies to that SSR process instead of serving a static index.html. The rest of this page (API proxy, SSE location, container) is unchanged.")}
    ${p("That is the full path: from the signal on page 2 to a hardened container in production. Welcome to dxjs.")}
  `,
);

// The ordered LEARN track. Prepended to the sidebar so it reads top-to-bottom.
export const learnPages: Page[] = [
  { id: "learn-why", label: "1 · Why dxjs", group: "Learn", view: WhyPage },
  { id: "learn-signals", label: "2 · Thinking in signals", group: "Learn", view: SignalsPage },
  { id: "learn-first-app", label: "3 · First app", group: "Learn", view: FirstAppPage },
  { id: "learn-components", label: "4 · Components that scale", group: "Learn", view: ScalePage },
  { id: "learn-backend", label: "5 · Talking to a backend", group: "Learn", view: BackendPage },
  { id: "learn-deploy", label: "6 · Ship it (nginx + delonix)", group: "Learn", view: DeployPage },
];
