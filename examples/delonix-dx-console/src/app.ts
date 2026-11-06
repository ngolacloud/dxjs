// delonix-dx-console — a proof of concept: the delonix-console dashboard + containers
// interfaces, rebuilt on dxjs (+ the React-parity packages: query, forms, virtualList,
// context, onError). The shell is @dxjs/ui's appShell; the active page is MOUNTED into
// the content host (and disposed on switch) so each page gets real component context —
// and is wrapped so a thrown page error is caught by the shell's onError boundary.
import { signal, effect, provide, onError } from "@dxjs/core";
import { html } from "@dxjs/dom";
import { component, mount, onMount, type Component } from "@dxjs/component";
import { appShell, card } from "@dxjs/ui";
import { AppContext, makeAppCtx } from "./ctx.ts";
import { DashboardPage } from "./dashboard.ts";
import { ContainersPage } from "./containers.ts";

const ctx = makeAppCtx();
const active = signal("dashboard");
const crash = signal("");

const soon = (label: string): Component =>
  component(() =>
    html`<h1 class="dx-h1">${label}</h1>${card({
      body: html`<p class="muted">Outside this proof of concept. The real console renders an honest “Unavailable” panel here — the same six data states as every other panel.</p>`,
    })}`,
  );

interface Page { id: string; label: string; view: Component; }
const PAGES: Page[] = [
  { id: "dashboard", label: "Dashboard", view: DashboardPage },
  { id: "containers", label: "Containers", view: ContainersPage },
  { id: "images", label: "Images", view: soon("Images") },
  { id: "stacks", label: "Stacks", view: soon("Stacks") },
  { id: "networks", label: "Networks", view: soon("Networks") },
  { id: "volumes", label: "Volumes", view: soon("Volumes") },
];

const Shell = component(() => {
  // A page-level error boundary: a thrown page effect/computed lands here.
  onError((e) => crash.set((e as Error).message ?? String(e)));

  // Re-mount the active page into #page, providing the app context for THIS mount
  // (so the page's useApp()/inject resolves during its construction), and disposing
  // the previous page. Wrapped in a createRoot so page effects sit under this
  // boundary (the shell's onError).
  onMount(() => {
    const host = document.getElementById("page");
    if (!host) return;
    let dispose = (): void => {};
    const stop = effect(() => {
      const id = active(); // tracked: re-runs on navigation
      const pg = PAGES.find((x) => x.id === id) ?? PAGES[0]!;
      dispose();
      // provide the context for THIS page's construction (its useApp/inject
      // resolves while the component builds); mount() returns the disposer.
      dispose = provide(AppContext, ctx, () => mount(pg.view, host, {}));
    });
    return () => {
      stop();
      dispose();
    };
  });

  return appShell({
    brand: "Delonix",
    nav: () => PAGES.map((pg) => ({ label: pg.label, active: active() === pg.id, onSelect: () => active.set(pg.id) })),
    user: { name: ctx.tenant, initials: "AC" },
    search: { placeholder: "Search containers, images…" },
    content: html`
      ${() => (crash() ? html`<div class="crash">⚠ ${() => crash()} — <button class="linkish" @click=${() => crash.set("")}>dismiss</button></div>` : "")}
      <div id="page"></div>
    `,
  });
});

mount(Shell, document.getElementById("app")!, {});
(window as unknown as { __dxready: boolean }).__dxready = true;
