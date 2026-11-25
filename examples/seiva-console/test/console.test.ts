// DOM tests for the console component (happy-dom). Proves: the table renders
// from a mocked registry+spec, the create affordance appears when can.create is
// set, an attacker-controlled field renders as TEXT (no element injected), and
// the bearer token rides in the Authorization header of the registry fetch.
import { body, fire } from "../../../packages/dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "@dxjs/transport";
import { mount } from "@dxjs/component";
import { SeivaConsole } from "../src/console.ts";
import { callOp } from "../src/api.ts";

// A value that WOULD inject an <img> if ever written as HTML. It must surface as
// inert text — the whole point of dxjs's safe sinks under a strict CSP.
const XSS = '<img onerror="window.__pwned=1" src=x>';

interface Call {
  url: string;
  init: RequestInit;
}

// A fetch mock: records every call and routes by URL to fake JSON responses.
function makeMock(): { fetch: typeof fetch; calls: Call[] } {
  const calls: Call[] = [];
  const reply = (status: number, bodyText: string): Response =>
    ({
      ok: status >= 200 && status < 300,
      status,
      statusText: "OK",
      text: () => Promise.resolve(bodyText),
    }) as unknown as Response;

  const registry = {
    resources: [
      {
        namespace: "shop",
        resource: "widgets",
        label: "Widgets",
        version: "v1",
        list_fields: ["id", "name"],
        can: { view: true, create: true, change: false, delete: false },
      },
    ],
  };
  const spec = {
    paths: {
      "/v1/widgets": {
        get: {},
        post: {
          requestBody: { content: { "application/json": { schema: { type: "object", properties: { name: {} } } } } },
        },
      },
      "/v1/widgets/{id}": { get: {} },
    },
  };
  const rows = [{ id: 1, name: XSS }];

  const mockFetch = ((input: unknown, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    const pathOnly = url.split("?")[0];
    if (pathOnly.endsWith("/admin/registry.json")) return Promise.resolve(reply(200, JSON.stringify(registry)));
    if (pathOnly.endsWith("/openapi.json")) return Promise.resolve(reply(200, JSON.stringify(spec)));
    if (pathOnly === "/v1/widgets") return Promise.resolve(reply(200, JSON.stringify(rows)));
    return Promise.resolve(reply(404, "{}"));
  }) as unknown as typeof fetch;

  return { fetch: mockFetch, calls };
}

const tick = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
async function settle(): Promise<void> {
  for (let i = 0; i < 6; i++) await tick();
}

test("renders a table, create form, escapes values, and sends the bearer", async () => {
  const host = body();
  const { fetch: mockFetch, calls } = makeMock();
  const client = createClient({ fetch: mockFetch });
  mount(SeivaConsole, host, { client });

  // Enter a token: fires the input's `change`, which reloads with the bearer.
  const tokenInput = host.querySelector("#token") as HTMLInputElement;
  tokenInput.value = "TESTTOKEN";
  fire(tokenInput, "change");
  await settle();

  // The console is dressed in @dxjs/ui: the shell + the resource's dataTable,
  // whose card title carries the resource label.
  assert.ok(host.querySelector(".dx-shell"), "the @dxjs/ui app shell rendered");
  const h2 = host.querySelector(".res h2");
  assert.ok(h2, "a resource card rendered");
  assert.match(h2!.textContent ?? "", /Widgets/);
  assert.ok(host.querySelector("table.dx-tbl"), "a @dxjs/ui data table rendered (resource has a list op + can.view)");

  // can.create is true → the create form is present.
  assert.ok(host.querySelector("form.create"), "the create form appears when can.create is true");

  // XSS safety: the malicious value is TEXT, not a parsed element.
  assert.equal(host.querySelector("img"), null, "no <img> element was ever created from row data");
  const cells = [...host.querySelectorAll("table.dx-tbl td")].map((td) => td.textContent ?? "");
  assert.ok(cells.some((t) => t.includes("<img")), "the raw markup shows up as inert text in a cell");
  assert.equal((globalThis as Record<string, unknown>).__pwned, undefined, "the onerror handler never ran");

  // The bearer rides in the Authorization header of a registry fetch.
  const regCalls = calls.filter((c) => c.url.split("?")[0].endsWith("/admin/registry.json"));
  const authed = regCalls.find((c) => {
    const h = (c.init.headers ?? {}) as Record<string, string>;
    return h.authorization === "Bearer TESTTOKEN";
  });
  assert.ok(authed, "the token was sent as 'Bearer TESTTOKEN' on /admin/registry.json");

  // ...and never on /openapi.json (public) nor in any URL.
  const specCall = calls.find((c) => c.url.endsWith("/openapi.json"));
  const specHeaders = (specCall?.init.headers ?? {}) as Record<string, string>;
  assert.equal(specHeaders.authorization, undefined, "no bearer on the public spec fetch");
  assert.ok(!calls.some((c) => c.url.includes("TESTTOKEN")), "the token never appears in a URL");
});

test("callOp surfaces a structured SeivaError (kind + field errors + trace) on a 422", async () => {
  const fetch422 = (() =>
    Promise.resolve({
      ok: false,
      status: 422,
      statusText: "Unprocessable",
      text: () => Promise.resolve(JSON.stringify({ fields: { name: "is required" }, trace_id: "tp-9" })),
    } as unknown as Response)) as unknown as typeof fetch;
  const client = createClient({ fetch: fetch422 });
  const e = await callOp(client, "POST", "/v1/widgets", { name: "" }, "tok").then(
    () => null,
    (x: unknown) => x as { name: string; kind: string; fields?: Record<string, string>; traceId?: string },
  );
  assert.ok(e, "the call rejected");
  assert.equal(e!.name, "SeivaError");
  assert.equal(e!.kind, "validation");
  assert.deepEqual(e!.fields, { name: "is required" });
  assert.equal(e!.traceId, "tp-9");
});
