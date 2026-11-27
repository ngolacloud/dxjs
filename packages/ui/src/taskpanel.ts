// @dxjs/ui/taskpanel — a side panel of tasks (the "Tasks" rail next to a board or
// record, as in Odoo / MS Project). A header with a live count, an optional
// grouping, and per-task: a completion checkbox, title, a meta line, a priority
// badge and a thin progress bar. Class-only, reactive, CSP-safe.

import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, type Maybe, type Tone } from "./base.ts";
import { checkbox } from "./controls.ts";
import { icon, type IconName } from "./icons.ts";

export type TaskPriority = "low" | "med" | "high";

export interface Task {
  id: string;
  title: string;
  done?: boolean;
  /** Who it is assigned to (initials or short name). */
  assignee?: string;
  /** A due date/short meta string (shown as-is). */
  due?: string;
  priority?: TaskPriority;
  /** 0..1 completion for the thin bar. */
  progress?: number;
}
export interface TaskGroup {
  label: string;
  tasks: Task[];
}
export interface TaskPanelOptions {
  title?: string;
  /** A flat list of tasks … */
  tasks?: Maybe<Task[]>;
  /** … or grouped sections (takes precedence over `tasks`). */
  groups?: Maybe<TaskGroup[]>;
  /** Toggle a task's completion (checkbox). */
  onToggle?: (id: string, done: boolean) => void;
  /** Click a task row (open it). */
  onSelect?: (id: string) => void;
  /** Action in the header (e.g. an "add" button). */
  action?: { label: string; icon?: IconName; onClick: () => void };
  footer?: Maybe<TemplateResult>;
}

const PRIORITY_TONE: Record<TaskPriority, Tone> = { high: "neg", med: "warn", low: "mut" };

/** A side task panel. Pass `tasks` (flat) or `groups` (sectioned). The header
 *  count is the total across whichever was given. */
export function taskPanel(o: TaskPanelOptions): TemplateResult {
  const allTasks = (): Task[] => {
    const g = o.groups ? read(o.groups) : null;
    if (g) return g.flatMap((x) => x.tasks);
    return read(o.tasks ?? []);
  };

  const taskRow = (t: Task): TemplateResult => {
    const pct = (): number => Math.max(0, Math.min(1, t.progress ?? 0)) * 100;
    return html`<li class=${cx("dx-tp-task", t.done && "is-done")}>
      <span class="dx-tp-check" @click=${(e: Event) => e.stopPropagation()}>${checkbox({
        checked: () => !!t.done,
        onChange: (on) => o.onToggle?.(t.id, on),
        ariaLabel: t.title,
      })}</span>
      <button
        class="dx-tp-main"
        type="button"
        ?disabled=${!o.onSelect}
        @click=${() => o.onSelect?.(t.id)}
      >
        <span class="dx-tp-title">${t.title}</span>
        ${t.assignee || t.due
          ? html`<span class="dx-tp-meta">${t.assignee ? html`<span class="dx-tp-assignee">${t.assignee}</span>` : ""}${t.due ? html`<span class="dx-tp-due">${icon("clock", { size: 12 })}${t.due}</span>` : ""}</span>`
          : ""}
        ${t.progress != null && !t.done
          ? html`<svg class="dx-tp-bar" viewBox="0 0 100 3" preserveAspectRatio="none" aria-hidden="true"><rect class="dx-tp-bar-fill" x="0" y="0" width=${() => pct()} height="3" rx="1.5"></rect></svg>`
          : ""}
      </button>
      ${t.priority ? html`<span class=${cx("dx-tp-pri", `is-${PRIORITY_TONE[t.priority]}`)} aria-label=${`Priority: ${t.priority}`}>${t.priority}</span>` : ""}
    </li>`;
  };

  const section = (g: TaskGroup): TemplateResult =>
    html`<div class="dx-tp-group">
      <div class="dx-tp-grouphead"><span class="dx-tp-grouplabel">${g.label}</span><span class="dx-tp-groupcount">${g.tasks.length}</span></div>
      <ul class="dx-tp-list">${list(() => g.tasks, (t) => t.id, taskRow)}</ul>
    </div>`;

  return html`<aside class="dx-tp" aria-label=${o.title ?? "Tasks"}>
    <header class="dx-tp-head">
      <span class="dx-tp-ico" aria-hidden="true">${icon("tasks", { size: 16 })}</span>
      <h2 class="dx-tp-htitle">${o.title ?? "Tasks"}</h2>
      <span class="dx-tp-count">${() => allTasks().length}</span>
      ${o.action
        ? html`<button class="dx-tp-action" type="button" aria-label=${o.action.label} @click=${() => o.action!.onClick()}>${icon(o.action.icon ?? "plus", { size: 16 })}</button>`
        : ""}
    </header>
    <div class="dx-tp-body">
      ${() => {
        const groups = o.groups ? read(o.groups) : null;
        if (groups) return html`${list(() => read(o.groups!), (g) => g.label, section)}`;
        const flat = read(o.tasks ?? []);
        return flat.length
          ? html`<ul class="dx-tp-list">${list(() => read(o.tasks ?? []), (t) => t.id, taskRow)}</ul>`
          : html`<div class="dx-tp-empty">No tasks.</div>`;
      }}
    </div>
    ${o.footer ? html`<footer class="dx-tp-foot">${() => read(o.footer!)}</footer>` : ""}
  </aside>`;
}
