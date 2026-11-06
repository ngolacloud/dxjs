// SeivaConsole — the Delonix Seiva "Console Admin" reproduced with dxjs.
//
// Parity with seiva/crates/seiva-console-admin/src/lib.rs (ADMIN_JS):
//   - a bearer-token input whose `change` reloads the console (so entering a
//     token reveals the resources the caller is authorized to see);
//   - it fetches /admin/registry.json (with the token) and /openapi.json, then
//     for each registered resource renders EITHER a data table (when it has a
//     `list` op and can.view) OR operation forms;
//   - EVERY value is written through dxjs safe sinks (textContent / setAttribute),
//     never innerHTML of data, so an attacker-controlled field cannot inject an
//     element — the strict admin CSP needs no unsafe-inline.
//
// The `can.*` flags only hide affordances the caller lacks. They are NOT a
// security boundary: the Seiva backend enforces every operation server-side via
// the module's #[seiva::controller]. We mirror that stance exactly.

import { signal } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { component, onMount } from "@dxjs/component";
import type { Client } from "@dxjs/transport";
import { classifyOps, bodyFields, opsForResource, type Classified, type OpenApiSpec } from "./contract.ts";
import { loadRegistry, loadSpec, callOp, type AdminResource } from "./api.ts";

type TokenAccessor = () => string;

/** Read every `[data-k]` control in a form into a plain-object request body. */
function collectForm(form: Element): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  form.querySelectorAll("[data-k]").forEach((node) => {
    const el = node as HTMLInputElement;
    const key = el.dataset.k;
    if (!key) return;
    if (el.value === "") return;
    body[key] = el.value;
  });
  return body;
}

/** The create form for a resource (shown only when the caller may create). */
function createForm(client: Client, token: TokenAccessor, create: NonNullable<Classified["create"]>): TemplateResult {
  const out = signal("");
  const fields = bodyFields(create.op);
  const onSubmit = (ev: Event): void => {
    ev.preventDefault();
    const body = collectForm(ev.target as Element);
    out.set("…");
    callOp(client, "POST", create.path, body, token())
      .then(() => out.set("created"))
      .catch((e: unknown) => out.set("create failed: " + String(e)));
  };
  return html`<form class="op create" @submit=${onSubmit}>
    <div class="sig"><span class="m">POST</span><span class="path">${create.path}</span></div>
    <div class="fields">
      ${fields.map((n) => html`<label>${n} <input data-k=${n} /></label>`)}
    </div>
    <button type="submit">Create</button>
    <div class="out">${() => out()}</div>
  </form>`;
}

/** One table row — every cell written as TEXT (auto-escaped), never parsed as HTML. */
function dataRow(fields: string[], item: Record<string, unknown>): TemplateResult {
  return html`<tr>
    ${fields.map((f) => html`<td>${item[f] === undefined ? "" : item[f]}</td>`)}
  </tr>`;
}

/** A resource with a `list` op renders the admin table: optional create + rows. */
function dataResource(
  client: Client,
  token: TokenAccessor,
  r: AdminResource,
  k: Classified,
): TemplateResult {
  const rows = signal<Array<Record<string, unknown>>>([]);
  const msg = signal("loading…");
  const fields = r.list_fields && r.list_fields.length ? r.list_fields : ["id"];
  const list = k.list as NonNullable<Classified["list"]>;

  // Fire the list call. Mirrors ADMIN_JS refresh(), minus the search/order/page
  // controls (an example-level cut). Fire-and-forget: results land via signals.
  const refresh = (): void => {
    callOp(client, "GET", list.path, undefined, token())
      .then((data) => {
        const arr = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
        rows.set(arr);
        msg.set(arr.length ? "" : "no records yet");
      })
      .catch((e: unknown) => msg.set("could not list: " + String(e)));
  };
  refresh();

  return html`<div class="res">
    <h2>${r.label} <span class="muted">${r.namespace}/${r.resource}</span></h2>
    ${k.create && r.can && r.can.create ? createForm(client, token, k.create) : ""}
    <table class="tbl">
      <thead><tr>${fields.map((f) => html`<th>${f}</th>`)}</tr></thead>
      <tbody>${() => rows().map((item) => dataRow(fields, item))}</tbody>
    </table>
    <div class="rowmsg">${() => msg()}</div>
  </div>`;
}

/** An operation form for an operations-only resource (no `list` op). */
function operationForm(client: Client, token: TokenAccessor, method: string, path: string): TemplateResult {
  const out = signal("");
  const onSubmit = (ev: Event): void => {
    ev.preventDefault();
    const m = method.toUpperCase();
    const body = m === "GET" ? undefined : collectForm(ev.target as Element);
    out.set("…");
    callOp(client, m, path, body, token())
      .then(() => out.set("ok"))
      .catch((e: unknown) => out.set("failed: " + String(e)));
  };
  return html`<form class="op" @submit=${onSubmit}>
    <div class="sig"><span class="m">${method.toUpperCase()}</span><span class="path">${path}</span></div>
    <button type="submit">Send</button>
    <div class="out">${() => out()}</div>
  </form>`;
}

/** An operations-only resource: forms for the operations the caller may invoke. */
function opsResource(
  client: Client,
  token: TokenAccessor,
  r: AdminResource,
  spec: OpenApiSpec,
): TemplateResult {
  const forms: TemplateResult[] = [];
  for (const { method, path } of opsForResource(spec, r.resource)) {
    const isWrite = method !== "get";
    // Hide write operations the caller lacks; the server still enforces.
    if (isWrite && !(r.can && (r.can.create || r.can.change))) continue;
    forms.push(operationForm(client, token, method, path));
  }
  return html`<div class="res">
    <h2>${r.label} <span class="muted">${r.namespace}/${r.resource}</span></h2>
    ${forms.length ? forms : html`<div class="op muted">No operations available to you for this resource.</div>`}
  </div>`;
}

/** Pick the table UI (list op + can.view) or the operation-forms UI. */
function renderResource(
  client: Client,
  token: TokenAccessor,
  r: AdminResource,
  spec: OpenApiSpec,
): TemplateResult {
  const k = classifyOps(spec, r.resource);
  if (k.list && r.can && r.can.view) return dataResource(client, token, r, k);
  return opsResource(client, token, r, spec);
}

/** The Seiva admin console as a dxjs component. */
export const SeivaConsole = component<{ client: Client }>((props) => {
  const token = signal("");
  const intro = signal("Loading the service contract…");
  const spec = signal<OpenApiSpec>({ paths: {} });
  const resources = signal<AdminResource[]>([]);

  const load = (): void => {
    Promise.all([loadRegistry(props.client, token()), loadSpec(props.client)])
      .then(([reg, sp]) => {
        spec.set(sp);
        const rs = (reg && reg.resources) || [];
        resources.set(rs);
        intro.set(
          rs.length
            ? `${rs.length} resource(s) you may administer.`
            : "No resources are registered for you. A module appears here when it registers an admin resource and you hold its view permission.",
        );
      })
      .catch((e: unknown) => {
        resources.set([]);
        intro.set("could not load the console: " + String(e));
      });
  };

  // Re-run on token change so entering a token reveals the authorized resources.
  const onTokenChange = (ev: Event): void => {
    token.set((ev.target as HTMLInputElement).value.trim());
    load();
  };

  onMount(() => {
    load();
  });

  return html`<div class="seiva-admin">
    <header>
      <h1>Seiva Admin</h1>
      <div class="tok"><input id="token" @change=${onTokenChange} placeholder="Bearer token (for guarded operations)" /></div>
    </header>
    <main>
      <p class="muted" id="intro">${() => intro()}</p>
      <div id="resources">
        ${() => resources().map((r) => renderResource(props.client, () => token(), r, spec()))}
      </div>
    </main>
  </div>`;
});
