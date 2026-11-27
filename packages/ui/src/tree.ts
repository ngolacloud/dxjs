// @dxjs/ui/tree — a hierarchical tree view. Class-only styling (CSP-safe): the
// per-row indent comes from a `--dx-tree-depth` custom property set through a ref
// (`el.style.setProperty`), never a `style=` attribute, and the chevron rotation
// is a toggled class. Expansion lives in a signal of a Set; the root is a
// role="tree" with role="treeitem" rows (aria-expanded only on parents,
// aria-selected, aria-level) and nested role="group" containers. Enter/Space on
// the focused item toggles a parent and/or selects it; arrows expand/collapse.

import { signal } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, type Maybe } from "./base.ts";
import { icon, type IconName } from "./icons.ts";

/** A node in the tree. A node with a non-empty `children` is a parent (gets a
 *  disclosure chevron); a leaf shows its `icon` or a dot. */
export interface TreeNode {
  id: string;
  label: string;
  icon?: IconName;
  children?: TreeNode[];
  disabled?: boolean;
}

export interface TreeOptions {
  nodes: Maybe<TreeNode[]>;
  /** The selected node id (controlled). */
  selected?: Maybe<string>;
  /** Ids expanded on first render. */
  defaultExpanded?: string[];
  onSelect?: (id: string) => void;
  onToggle?: (id: string, expanded: boolean) => void;
}

const hasKids = (n: TreeNode): boolean => !!(n.children && n.children.length > 0);

/** A hierarchical tree view. Parents expand/collapse; leaves select. */
export function tree(o: TreeOptions): TemplateResult {
  const expanded = signal<Set<string>>(new Set(o.defaultExpanded ?? []));
  const isOpen = (id: string): boolean => expanded().has(id);

  const toggle = (n: TreeNode): void => {
    const next = new Set(expanded());
    const open = !next.has(n.id);
    if (open) next.add(n.id);
    else next.delete(n.id);
    expanded.set(next);
    o.onToggle?.(n.id, open);
  };

  const activate = (n: TreeNode): void => {
    if (n.disabled) return;
    o.onSelect?.(n.id);
    if (hasKids(n)) toggle(n);
  };

  // Roving tabindex: the selected row is tabbable, else the first root row.
  const tabbable = (n: TreeNode): boolean => {
    const sel = read(o.selected ?? "");
    if (sel) return n.id === sel;
    const first = read(o.nodes)?.[0];
    return !!first && first.id === n.id;
  };

  // Set the indent depth as a custom property on the row (not an inline style).
  const setDepth = (depth: number) => (el: Element): void => {
    (el as HTMLElement).style.setProperty("--dx-tree-depth", String(depth));
  };

  const onKey = (n: TreeNode) => (e: KeyboardEvent): void => {
    const k = e.key;
    if (k !== "Enter" && k !== " " && k !== "ArrowRight" && k !== "ArrowLeft") return;
    // A key we own: never let it bubble to an ancestor treeitem, even on a
    // disabled node (focus is on this row, so this row owns the keystroke).
    e.preventDefault();
    e.stopPropagation();
    if (n.disabled) return;
    const kids = hasKids(n);
    if (k === "Enter" || k === " ") activate(n);
    else if (k === "ArrowRight" && kids && !isOpen(n.id)) toggle(n);
    else if (k === "ArrowLeft" && kids && isOpen(n.id)) toggle(n);
  };

  const renderItem = (n: TreeNode, depth: number): TemplateResult => {
    const kids = hasKids(n);
    const open = (): boolean => isOpen(n.id);

    const chevron = kids
      ? html`<span
          class=${() => cx("dx-tree-chevron", open() && "is-open")}
          aria-hidden="true"
          @click=${(e: MouseEvent) => {
            e.stopPropagation();
            if (!n.disabled) toggle(n);
          }}
          >${icon("chevron-right", { size: 16 })}</span
        >`
      : n.icon
        ? ""
        : html`<span class="dx-tree-dot" aria-hidden="true"></span>`;

    const glyph = n.icon
      ? html`<span class="dx-tree-ico" aria-hidden="true">${icon(n.icon, { size: 16 })}</span>`
      : "";

    return html`<div
      class="dx-tree-item"
      role="treeitem"
      aria-level=${depth + 1}
      aria-selected=${() => (read(o.selected ?? "") === n.id ? "true" : "false")}
      aria-expanded=${kids ? () => (open() ? "true" : "false") : false}
      aria-disabled=${n.disabled ? "true" : false}
      tabindex=${() => (tabbable(n) ? 0 : -1)}
      @click=${(e: MouseEvent) => {
        e.stopPropagation();
        activate(n);
      }}
      @keydown=${onKey(n)}
    >
      <div
        class=${() => cx("dx-tree-row", read(o.selected ?? "") === n.id && "is-selected", n.disabled && "is-disabled")}
        ref=${setDepth(depth)}
      >
        ${chevron}${glyph}<span class="dx-tree-label">${n.label}</span>
      </div>
      ${kids
        ? html`<div class="dx-tree-group" role="group" ?hidden=${() => !open()}>${list(
            () => n.children ?? [],
            (c) => c.id,
            (c) => renderItem(c, depth + 1),
          )}</div>`
        : ""}
    </div>`;
  };

  return html`<div class="dx-tree" role="tree">${list(
    () => read(o.nodes),
    (n) => n.id,
    (n) => renderItem(n, 0),
  )}</div>`;
}
