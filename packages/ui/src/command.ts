// @dxjs/ui/command — a ⌘K command palette: a modal search-and-run overlay. Type
// to filter commands by label/keywords; results stay grouped under headings;
// ArrowUp/Down move the active command across every group, Enter runs it, Escape
// (or a backdrop click) closes. Class-only and CSP-safe — no inline styles or
// handlers, no eval. role=dialog over a backdrop; the results are a role=listbox
// of role=option rows with aria-selected tracking the active one.

import { signal } from "@dxjs/core";
import { html, type TemplateResult } from "@dxjs/dom";
import { read, nextId, cx, type Maybe } from "./base.ts";
import { icon, type IconName } from "./icons.ts";

/** One runnable command in the palette. */
export interface CommandItem {
  /** Stable id (unique across all groups). */
  id: string;
  label: string;
  /** Optional leading icon. */
  icon?: IconName;
  /** Secondary muted text shown after the label. */
  hint?: string;
  /** Shortcut shown as a `dx-kbd` badge, e.g. "⌘K" or "G then H". */
  shortcut?: string;
  /** Extra terms the search matches beyond the label. */
  keywords?: string[];
  onRun: () => void;
}

/** A labelled cluster of commands. */
export interface CommandGroup {
  heading?: string;
  items: CommandItem[];
}

export interface CommandPaletteOptions {
  /** Whether the palette is shown (controlled by the caller). */
  open: Maybe<boolean>;
  /** Called on Escape, a backdrop click, or after a command runs. */
  onClose?: () => void;
  groups: Maybe<CommandGroup[]>;
  /** Search box placeholder (default "Type a command or search…"). */
  placeholder?: string;
  /** Shown when the query matches nothing (default "No results found."). */
  emptyText?: string;
}

/** A ⌘K command menu. Render it once (hidden until `open` is true); drive `open`
 *  from the caller and clear it in `onClose`. */
export function commandPalette(o: CommandPaletteOptions): TemplateResult {
  const query = signal("");
  const active = signal(0);
  const listId = nextId("dx-cmd-list");

  const matches = (it: CommandItem, q: string): boolean => {
    if (!q) return true;
    const hay = `${it.label} ${it.keywords?.join(" ") ?? ""} ${it.hint ?? ""}`.toLowerCase();
    return hay.includes(q);
  };

  // Groups with their non-matching items dropped, empty groups removed.
  const filteredGroups = (): CommandGroup[] => {
    const q = query().trim().toLowerCase();
    return read(o.groups)
      .map((g) => ({ heading: g.heading, items: g.items.filter((it) => matches(it, q)) }))
      .filter((g) => g.items.length > 0);
  };

  // The visible commands flattened in group order — the space the active index
  // and Up/Down navigation range over.
  const flat = (): CommandItem[] => filteredGroups().flatMap((g) => g.items);

  const optionId = (it: CommandItem): string => `${listId}-opt-${it.id}`;
  const activeId = (): string => {
    const it = flat()[active()];
    return it ? optionId(it) : "";
  };

  const close = (): void => {
    query.set("");
    active.set(0);
    o.onClose?.();
  };
  const run = (it: CommandItem): void => {
    it.onRun();
    close();
  };
  const step = (delta: number): void => {
    const items = flat();
    const n = items.length;
    if (n === 0) return;
    active.set((((active() + delta) % n) + n) % n);
  };
  const runActive = (): void => {
    const it = flat()[active()];
    if (it) run(it);
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      step(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      step(-1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      runActive();
    }
  };

  // The active index refers to the FLAT list, so each row carries its own flat
  // position (computed when the results rebuild on a query change). Only the
  // class/aria-selected read `active()`, so Up/Down re-paint without a rebuild.
  const itemView = (it: CommandItem, flatIdx: number): TemplateResult =>
    html`<button
      class=${() => cx("dx-cmd-item", active() === flatIdx && "is-active")}
      type="button"
      role="option"
      id=${optionId(it)}
      aria-selected=${() => (active() === flatIdx ? "true" : "false")}
      @click=${() => run(it)}
      @mousemove=${() => active() !== flatIdx && active.set(flatIdx)}
    >${it.icon ? html`<span class="dx-cmd-ico" aria-hidden="true">${icon(it.icon, { size: 18 })}</span>` : ""}<span
        class="dx-cmd-text"
      ><span class="dx-cmd-label">${it.label}</span>${it.hint
        ? html`<span class="dx-cmd-hint">${it.hint}</span>`
        : ""}</span>${it.shortcut ? html`<kbd class="dx-kbd dx-cmd-kbd">${it.shortcut}</kbd>` : ""}</button>`;

  const groupView = (g: CommandGroup, start: number): TemplateResult =>
    html`<div class="dx-cmd-group" role="group" aria-label=${g.heading ?? false}>${g.heading
      ? html`<div class="dx-cmd-head" aria-hidden="true">${g.heading}</div>`
      : ""}${g.items.map((it, i) => itemView(it, start + i))}</div>`;

  const results = (): TemplateResult | TemplateResult[] => {
    const groups = filteredGroups();
    if (groups.length === 0) {
      return html`<div class="dx-cmd-empty">${o.emptyText ?? "No results found."}</div>`;
    }
    // Assign each group its starting offset in the flat list.
    let offset = 0;
    return groups.map((g) => {
      const view = groupView(g, offset);
      offset += g.items.length;
      return view;
    });
  };

  return html`<div
    class=${() => cx("dx-cmd-root", read(o.open) && "is-open")}
    ?hidden=${() => !read(o.open)}
    @keydown=${onKey}
  >
    <div class="dx-cmd-backdrop" @click=${() => close()}></div>
    <div class="dx-cmd" role="dialog" aria-modal="true" aria-label="Command palette">
      <div class="dx-cmd-search">
        ${icon("search", { class: "dx-cmd-search-ico", size: 18 })}
        <input
          class="dx-cmd-input"
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls=${listId}
          aria-autocomplete="list"
          aria-activedescendant=${() => activeId() || false}
          placeholder=${o.placeholder ?? "Type a command or search…"}
          aria-label=${o.placeholder ?? "Type a command or search"}
          .value=${() => query()}
          @input=${(e: Event) => {
            query.set((e.target as HTMLInputElement).value);
            active.set(0);
          }}
        />
      </div>
      <div class="dx-cmd-list" id=${listId} role="listbox" aria-label="Commands">${results}</div>
    </div>
  </div>`;
}
