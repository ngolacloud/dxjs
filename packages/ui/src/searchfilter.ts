// @dxjs/ui/searchfilter — an Odoo-style search & filter bar with facet chips,
// predefined Filters and Group By menus, and a Ctrl/Cmd+K hotkey to focus it.
// Typing offers "Search <field> for 'q'" suggestions; Enter/click adds a facet;
// Backspace on an empty input removes the last facet. CSP-safe (safe sinks, no
// eval); the hotkey is a document keydown registered once and torn down on cleanup.

import { signal, onCleanup } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { cx } from "./base.ts";

export interface SearchField {
  key: string;
  label: string;
}
export interface FilterDef {
  id: string;
  label: string;
}
export interface Facet {
  field: string;
  label: string;
  value: string;
}
export interface SearchState {
  facets: Facet[];
  filters: string[];
  groupBy: string[];
}
export interface SearchFilterOptions {
  /** Searchable fields → the "Search <label> for 'q'" suggestions. */
  fields: SearchField[];
  /** Predefined toggle filters (the "Filters" menu). */
  filters?: FilterDef[];
  /** Group-by options (the "Group By" menu). */
  groupBy?: FilterDef[];
  onChange?: (state: SearchState) => void;
  placeholder?: string;
  /** Bind Ctrl/Cmd+K to focus the search input. Default true. */
  hotkey?: boolean;
}

/** Pure matcher with Odoo semantics: OR within a field's facets, AND across
 *  fields. `get(row, field)` returns the row's value for a field. */
export function matchFacets<T>(row: T, facets: Facet[], get: (row: T, field: string) => string): boolean {
  if (facets.length === 0) return true;
  const byField = new Map<string, string[]>();
  for (const f of facets) (byField.get(f.field) ?? byField.set(f.field, []).get(f.field)!).push(f.value.toLowerCase());
  for (const [field, values] of byField) {
    const hay = String(get(row, field) ?? "").toLowerCase();
    if (!values.some((v) => hay.includes(v))) return false;
  }
  return true;
}

export function searchFilter(o: SearchFilterOptions): TemplateResult {
  const q = signal("");
  const facets = signal<Facet[]>([]);
  const filters = signal<string[]>([]);
  const groupBy = signal<string[]>([]);
  const menu = signal<"none" | "filters" | "groupby">("none");
  const suggest = signal(false);
  let inputEl: HTMLInputElement | null = null;

  const emit = (): void => o.onChange?.({ facets: facets(), filters: filters(), groupBy: groupBy() });

  const addFacet = (field: SearchField): void => {
    const value = q().trim();
    if (!value) return;
    facets.set([...facets(), { field: field.key, label: field.label, value }]);
    q.set("");
    suggest.set(false);
    emit();
  };
  const removeFacet = (i: number): void => {
    facets.set(facets().filter((_, idx) => idx !== i));
    emit();
  };
  const toggle = (sig: typeof filters, id: string): void => {
    sig.set(sig().includes(id) ? sig().filter((x) => x !== id) : [...sig(), id]);
    emit();
  };

  const onKey = (e: KeyboardEvent): void => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (q().trim()) addFacet(o.fields[0]!);
    } else if (e.key === "Backspace" && q() === "" && facets().length) {
      removeFacet(facets().length - 1);
    } else if (e.key === "Escape") {
      suggest.set(false);
      menu.set("none");
    }
  };

  // Ctrl/Cmd+K → focus the search input (registered once; cleaned up on unmount).
  if (o.hotkey !== false) {
    const doc = (globalThis as { document?: Document }).document;
    if (doc) {
      const h = (e: KeyboardEvent): void => {
        if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
          e.preventDefault();
          inputEl?.focus();
        }
      };
      doc.addEventListener("keydown", h);
      onCleanup(() => doc.removeEventListener("keydown", h));
    }
  }

  const facetChip = (f: Facet, i: number): TemplateResult =>
    html`<span class="dx-sf-facet"><span class="dx-sf-facet-field">${f.label}</span>${f.value}<button class="dx-sf-facet-x" type="button" aria-label=${`Remove ${f.label}: ${f.value}`} @click=${() => removeFacet(i)}>×</button></span>`;

  const menuBtn = (which: "filters" | "groupby", label: string, defs: FilterDef[], sig: typeof filters): TemplateResult => html`
    <div class="dx-sf-menu">
      <button class="dx-sf-mbtn" type="button" aria-haspopup="menu" aria-expanded=${() => (menu() === which ? "true" : "false")} @click=${() => menu.set(menu() === which ? "none" : which)}>${label}<span class="dx-s2-caret" aria-hidden="true">▾</span></button>
      <div class="dx-sf-mlist" role="menu" ?hidden=${() => menu() !== which}>${defs.map(
        (d) => html`<button class=${() => cx("dx-sf-mitem", sig().includes(d.id) && "is-on")} role="menuitemcheckbox" type="button" aria-checked=${() => (sig().includes(d.id) ? "true" : "false")} @click=${() => toggle(sig, d.id)}><span class="dx-sf-check" aria-hidden="true">✓</span>${d.label}</button>`,
      )}</div>
    </div>`;

  return html`<div
    class="dx-sf"
    @focusout=${(e: FocusEvent) => {
      const root = e.currentTarget as HTMLElement;
      const next = e.relatedTarget as Node | null;
      if (!next || !root.contains(next)) {
        suggest.set(false);
        menu.set("none");
      }
    }}
  >
    <div class="dx-sf-box">
      <span class="dx-sf-ico" aria-hidden="true">⌕</span>
      ${list(() => facets(), (f, i) => `${f.field}:${f.value}:${i}`, facetChip)}
      <input
        class="dx-sf-input"
        type="text"
        role="combobox"
        aria-expanded=${() => (suggest() ? "true" : "false")}
        aria-label="Search"
        placeholder=${o.placeholder ?? "Search…"}
        .value=${() => q()}
        ref=${(el: Element) => (inputEl = el as HTMLInputElement)}
        @input=${(e: Event) => {
          q.set((e.target as HTMLInputElement).value);
          suggest.set(q().length > 0);
        }}
        @focus=${() => suggest.set(q().length > 0)}
        @keydown=${onKey}
      />
      <kbd class="dx-sf-kbd" aria-hidden="true">⌘K</kbd>
    </div>
    ${o.filters?.length ? menuBtn("filters", "Filters", o.filters, filters) : ""}
    ${o.groupBy?.length ? menuBtn("groupby", "Group By", o.groupBy, groupBy) : ""}
    <div class="dx-sf-suggest" role="listbox" ?hidden=${() => !suggest()}>${() =>
      q().trim()
        ? o.fields.map(
            (f) => html`<button class="dx-sf-sugg" role="option" type="button" @click=${() => addFacet(f)}>Search <b>${f.label}</b> for “<span class="dx-sf-q">${() => q()}</span>”</button>`,
          )
        : ""}</div>
  </div>`;
}
