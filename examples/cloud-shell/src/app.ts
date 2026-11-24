// examples/cloud-shell — the capstone: a real Cloud Shell composed from the Track
// D packages. appShell (navigation + theme) + a nested router whose pages are the
// terminal, the virtualized log viewer and the live k8s resource explorer, with a
// ⌘K command palette and idempotent toasts wired across the top. Everything runs
// under a strict CSP (classes + @event, escaped text — no eval, no inline).
import { html } from "@dxjs/dom";
import { component, mount, onMount, createRouter } from "@dxjs/component";
import { appShell, statGrid, createThemeController } from "@dxjs/ui";
import { createTerminal } from "@dxjs/terminal";
import { createLogViewer, type LogLine } from "@dxjs/logs";
import { createResourceStore, resourceExplorer, type K8sObject } from "@dxjs/k8s";
import { createCommandPalette, createToaster } from "@dxjs/shell";

interface NavEntry {
  label: string;
  path: string;
}
const NAV: NavEntry[] = [
  { label: "Dashboard", path: "/" },
  { label: "Terminal", path: "/terminal" },
  { label: "Logs", path: "/logs" },
  { label: "Resources", path: "/resources" },
];

const demoLogs: LogLine[] = [
  { ts: 1, source: "api", level: "info", text: "listening on :8080" },
  { ts: 2, source: "db", level: "warn", text: "slow query 420ms" },
  { ts: 3, source: "api", level: "error", text: "upstream timeout" },
];

const demoPods: K8sObject[] = [
  { kind: "Pod", metadata: { name: "web-7f9", uid: "u1", namespace: "default", resourceVersion: "1" }, status: { phase: "Running" } },
  { kind: "Pod", metadata: { name: "api-2c4", uid: "u2", namespace: "default", resourceVersion: "1" }, status: { phase: "Pending" } },
];

/** Build and mount the Cloud Shell into `host`. Returns a disposer. */
export function mountApp(host: Element): () => void {
  const theme = createThemeController("dark");
  const toaster = createToaster();

  const logs = createLogViewer({ height: 420, rowHeight: 22 });
  logs.append(demoLogs);

  const store = createResourceStore();
  store.reset(demoPods, "1");

  const term = createTerminal({
    onInput: (data) => {
      term.write("sh: command not found: " + data);
      toaster.notify({ key: "term", level: "info", text: "ran: " + data.trim() });
    },
  });
  term.write("Welcome to the dxjs Cloud Shell.\n");

  const Dashboard = component(() =>
    statGrid([
      { label: "PODS", value: String(store.list().length), tone: "mut" },
      { label: "SOURCES", value: String(logs.sources().length), delta: "live", tone: "pos" },
      { label: "THEME", value: () => theme.theme(), tone: "mut" },
      { label: "ERRORS", value: "1", delta: "+1", tone: "neg" },
    ]),
  );
  const TerminalPage = component(() => html`<div class="cs-panel">${() => term.view()}</div>`);
  const LogsPage = component(() => html`<div class="cs-panel">${() => logs.view()}</div>`);
  const ResourcesPage = component(() => resourceExplorer({ store, title: "Pods", pageSize: 50 }));

  const router = createRouter(
    [
      { path: "/", component: Dashboard },
      { path: "/terminal", component: TerminalPage },
      { path: "/logs", component: LogsPage },
      { path: "/resources", component: ResourcesPage },
    ],
    { fallback: "/" },
  );

  const palette = createCommandPalette([
    { id: "nav-dash", title: "Go to Dashboard", keywords: "home", run: () => router.navigate("/") },
    { id: "nav-term", title: "Go to Terminal", keywords: "shell", run: () => router.navigate("/terminal") },
    { id: "nav-logs", title: "Go to Logs", keywords: "tail", run: () => router.navigate("/logs") },
    { id: "nav-res", title: "Go to Resources", keywords: "pods kubernetes", run: () => router.navigate("/resources") },
    { id: "theme", title: "Toggle theme", keywords: "dark light", run: () => theme.toggle() },
  ]);

  const activePath = (): string => router.current()?.route.path ?? "/";

  const Shell = component(() => {
    let pageHost: Element | null = null;

    onMount(() => {
      if (pageHost) return router.outlet(pageHost);
      return undefined;
    });
    // Global ⌘K / Ctrl-K opens the palette.
    onMount(() => {
      const onKey = (e: KeyboardEvent): void => {
        if ((e.metaKey || e.ctrlKey) && e.key === "k") {
          e.preventDefault();
          palette.toggle();
        }
      };
      document.addEventListener("keydown", onKey);
      return () => document.removeEventListener("keydown", onKey);
    });

    return html`${appShell({
      brand: "dxjs Cloud",
      nav: () => NAV.map((n) => ({ label: n.label, active: activePath() === n.path, onSelect: () => router.navigate(n.path) })),
      topbar: html`<button class="dx-btn cs-theme" @click=${() => theme.toggle()}>Toggle theme</button>`,
      content: html`<div class="cs-page" ref=${(el: Element) => (pageHost = el)}></div>`,
    })}
    ${() => palette.view()}
    ${() => toaster.view()}`;
  });

  const disposeMount = mount(Shell, host, {});
  return () => {
    disposeMount();
    router.dispose(); // drop the popstate listener too
  };
}
