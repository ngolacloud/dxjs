// @dxjs/ui/kanban — a column board (to-do / doing / done). Controlled: the caller
// owns `columns` (reactive) and applies moves in `onMove`. Cards move by native
// drag-and-drop AND by keyboard-reachable ◀/▶ buttons (so it works without a
// pointer and is testable under a standards DOM). Class-only, CSP-safe.

import { signal } from "@dxjs/core";
import { html, list, type TemplateResult } from "@dxjs/dom";
import { read, cx, type Maybe, type Tone } from "./base.ts";

export interface KanbanCard {
  id: string;
  title: string;
  /** A short meta line (e.g. assignee · due). */
  meta?: string;
  body?: Maybe<TemplateResult | string>;
  tags?: string[];
}
export interface KanbanColumn {
  id: string;
  title: string;
  cards: KanbanCard[];
  /** Accent tone for the column header. */
  accent?: Tone;
}
export interface KanbanMove {
  card: string;
  from: string;
  to: string;
  /** Target index within the destination column. */
  index: number;
}
export interface KanbanOptions {
  columns: Maybe<KanbanColumn[]>;
  /** Apply a move. The caller mutates its own state (e.g. a signal of columns). */
  onMove?: (move: KanbanMove) => void;
  /** Enable HTML5 drag-and-drop in addition to the ◀/▶ buttons (default true). */
  draggable?: boolean;
  ariaLabel?: string;
}

/** A kanban board. Each card carries ◀/▶ buttons that move it to the adjacent
 *  column; drag-and-drop does the same with a drop index. Moves are reported via
 *  `onMove` — this component renders, the caller reorders. */
export function kanban(o: KanbanOptions): TemplateResult {
  const cols = (): KanbanColumn[] => read(o.columns);
  const dragCard = signal<string | null>(null);
  const useDrag = o.draggable !== false;

  // Read the LIVE column by id. The keyed column list reuses nodes when ids are
  // stable, so a closed-over `col` goes stale after a move — always re-derive
  // from `cols()` inside reactive reads and handlers.
  const liveCol = (id: string): KanbanColumn | undefined => cols().find((c) => c.id === id);
  const liveCards = (id: string): KanbanCard[] => liveCol(id)?.cards ?? [];
  const neighbour = (id: string, delta: number): KanbanColumn | undefined => {
    const all = cols();
    const i = all.findIndex((c) => c.id === id);
    return i < 0 ? undefined : all[i + delta];
  };

  const emit = (card: string, from: string, to: string, index: number): void => {
    if (from === to) return;
    o.onMove?.({ card, from, to, index });
  };

  const card = (colId: string, c: KanbanCard): TemplateResult => {
    const prev = (): KanbanColumn | undefined => neighbour(colId, -1);
    const next = (): KanbanColumn | undefined => neighbour(colId, 1);
    return html`<li
      class="dx-kb-card"
      draggable=${useDrag ? "true" : false}
      @dragstart=${useDrag ? () => dragCard.set(c.id) : undefined}
      @dragend=${useDrag ? () => dragCard.set(null) : undefined}
    >
      <div class="dx-kb-card-head">
        <span class="dx-kb-card-title">${c.title}</span>
      </div>
      ${c.meta ? html`<div class="dx-kb-card-meta">${c.meta}</div>` : ""}
      ${c.body ? html`<div class="dx-kb-card-body">${() => read(c.body!)}</div>` : ""}
      ${c.tags && c.tags.length ? html`<div class="dx-kb-card-tags">${c.tags.map((t) => html`<span class="dx-kb-tag">${t}</span>`)}</div>` : ""}
      <div class="dx-kb-card-move">
        <button
          class="dx-kb-move"
          type="button"
          aria-label=${() => (prev() ? `Move card to ${prev()!.title}` : "No previous column")}
          ?disabled=${() => !prev()}
          @click=${() => {
            const p = prev();
            if (p) emit(c.id, colId, p.id, p.cards.length);
          }}
        >◀</button>
        <button
          class="dx-kb-move"
          type="button"
          aria-label=${() => (next() ? `Move card to ${next()!.title}` : "No next column")}
          ?disabled=${() => !next()}
          @click=${() => {
            const n = next();
            if (n) emit(c.id, colId, n.id, n.cards.length);
          }}
        >▶</button>
      </div>
    </li>`;
  };

  const column = (col: KanbanColumn): TemplateResult =>
    html`<section
      class=${cx("dx-kb-col", col.accent && `is-${col.accent}`)}
      aria-label=${col.title}
      @dragover=${useDrag ? (e: DragEvent) => { if (dragCard()) e.preventDefault(); } : undefined}
      @drop=${useDrag
        ? (e: DragEvent) => {
            const id = dragCard();
            if (!id) return;
            e.preventDefault();
            const from = cols().find((c) => c.cards.some((k) => k.id === id));
            if (from) emit(id, from.id, col.id, liveCards(col.id).length);
            dragCard.set(null);
          }
        : undefined}
    >
      <header class="dx-kb-col-head">
        <span class="dx-kb-col-title">${col.title}</span>
        <span class="dx-kb-col-count">${() => liveCards(col.id).length}</span>
      </header>
      <ul class="dx-kb-list">${list(() => liveCards(col.id), (c) => c.id, (c) => card(col.id, c))}</ul>
    </section>`;

  return html`<div class="dx-kb" role="group" aria-label=${o.ariaLabel ?? "Board"}>${list(
    () => cols(),
    (c) => c.id,
    column,
  )}</div>`;
}
