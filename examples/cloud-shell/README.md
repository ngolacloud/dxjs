# cloud-shell — the dxjs Cloud Shell (capstone example)

A real console composed from the Track D packages, proving they integrate:

- **@dxjs/ui** `appShell` — sidebar nav + top bar + content, with a theme toggle
  (`createThemeController`, light/dark via tokens).
- **@dxjs/component** `createRouter` + `Outlet` — nested routing between the pages.
- **@dxjs/terminal** — a resilient line terminal page.
- **@dxjs/logs** — a virtualized, multi-source log viewer page.
- **@dxjs/k8s** — a live resource explorer page (watch store + dataTable).
- **@dxjs/shell** — a ⌘K command palette and idempotent toasts across the top.

Everything runs under a strict CSP (classes + `@event`, escaped text — no eval, no
inline). Entry point: `mountApp(host)` in `src/app.ts`.

```ts
import { mountApp } from "./src/app.ts";
mountApp(document.getElementById("app")!);
```

Proven by `examples/cloud-shell/test/app.test.ts` (part of `npm run check`): the
router switches pages with live panels, Ctrl-K opens the palette, a command
navigates, and the top bar toggles the theme.
