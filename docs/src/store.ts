// Tiny shared navigation store for the docs app. The active page id is a signal;
// `go(id)` switches pages (app.ts re-mounts the matching page). Landing CTAs and
// the sidebar both drive it.
import { signal } from "@dxjs/core";

export const active = signal<string>("overview");
export const go = (id: string): void => active.set(id);
