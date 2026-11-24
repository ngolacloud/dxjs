// Consumer smoke-test — a downstream TS app that imports @dxjs/* by bare
// specifier and is typechecked with `tsc --noEmit` (see tsconfig.json). It never
// runs; the point is that every symbol below resolves to a real published type
// from dist/index.d.ts. A missing build or a src-only package breaks `npm run
// typecheck:consumer`. This is the "Node + static typing" guarantee.

import { signal, computed, effect, batch, type Accessor } from "@dxjs/core";
import { html, list } from "@dxjs/dom";
import { component, mount, createRouter } from "@dxjs/component";
import { createClient, resource, createLiveSource } from "@dxjs/transport";
import { createQueryClient, query } from "@dxjs/query";
import { createForm } from "@dxjs/forms";

// --- core: signals are callable + have typed methods ----------------------
const n = signal(0);
const doubled: Accessor<number> = computed(() => n() * 2);
const dispose = effect(() => void doubled());
batch(() => {
  n.set(1);
  n.update((x) => x + 1);
});
const _peeked: number = n.peek();
dispose();

// --- dom + component: html is a TemplateResult; mount returns a disposer ---
interface Row {
  id: string;
  label: string;
}
const rows = signal<Row[]>([]);
const App = component(() => {
  return html`<ul>
    ${list(
      () => rows(),
      (r) => r.id,
      (r) => html`<li>${() => r.label}</li>`,
    )}
  </ul>`;
});
const unmount: () => void = mount(App, document.body, {});
unmount();

// --- component router ------------------------------------------------------
const router = createRouter([
  { path: "/accounts/:id", component: (ctx) => html`<div>account ${() => ctx.params.id}</div>` },
]);
void router;

// --- transport: typed REST + reactive resource + multiplexed SSE ----------
const api = createClient({ baseUrl: "/v1", auth: () => "token" });
async function load(): Promise<Row[]> {
  return api.get<Row[]>("/accounts");
}
const accounts = resource<Row[]>((sig) => api.get<Row[]>("/accounts", { signal: sig }), { initial: [] });
const _loading: boolean = accounts.loading();
accounts.refetch();

const live = createLiveSource("/v1/stream");
const online: Accessor<number> = live.signal<number>("online", { initial: 0 });
void online;

// --- query: cached/deduped async ------------------------------------------
const qc = createQueryClient();
const accountsQuery = query<Row[]>(qc, ["accounts"], load, { staleTime: 5000 });
const _data: Row[] | undefined = accountsQuery.data();

// --- forms: typed field accessors -----------------------------------------
const form = createForm<{ name: string; email: string }>({
  initial: { name: "", email: "" },
  validate: (v) => (v.email.includes("@") ? {} : { email: "invalid" }),
});
const submit = form.handleSubmit((values) => void values.name);
void submit;
const _valid: boolean = form.isValid();

export { _peeked, _loading, _data, _valid };
