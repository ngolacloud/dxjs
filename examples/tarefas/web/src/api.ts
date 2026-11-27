// The operations, described once — shared by every call site in the app.
import { method } from "@dxjs/transport";

export interface Task { id: string; title: string; done: boolean }

export const listTasks = method<Record<string, never>, Task[]>({
  id: "tasks.list",
  wire: { http: { method: "GET", path: "/v1/tasks" } },
  idempotent: true,
});
export const createTask = method<{ title: string }, Task>({
  id: "tasks.create",
  wire: { http: { method: "POST", path: "/v1/tasks" } },
});
export const toggleTask = method<{ id: string }, Task>({
  id: "tasks.toggle",
  wire: { http: { method: "POST", path: (r: { id: string }) => `/v1/tasks/${r.id}/toggle` } },
});
export const watchTasks = method<Record<string, never>, Task[]>({
  id: "tasks.watch",
  kind: "serverStream",
  wire: { http: { path: "/v1/tasks/stream" } },
});
