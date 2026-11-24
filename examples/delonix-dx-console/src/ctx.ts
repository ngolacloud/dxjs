// App context (DI by construction scope, @dxjs/core): the scoped api client, the
// query cache, and the session tenant. Provided once at the app root; pages read
// it at the top with useApp() — the parity equivalent of the console's
// useScopedClient() + the react-query client from context.
import { createContext, inject } from "@dxjs/core";
import { createQueryClient, type QueryClient } from "@dxjs/query";
import { api, type Api } from "./api.ts";

export interface AppCtx {
  api: Api;
  qc: QueryClient;
  tenant: string;
}

export const AppContext = createContext<AppCtx | null>(null);

export function makeAppCtx(): AppCtx {
  return { api, qc: createQueryClient(), tenant: "acme" };
}

/** Read the app context (throws if used outside its provider — a wiring bug). */
export function useApp(): AppCtx {
  const ctx = inject(AppContext);
  if (!ctx) throw new Error("useApp() called outside <AppContext> provider");
  return ctx;
}
