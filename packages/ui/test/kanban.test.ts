import { body, fire } from "../../dom/test/setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { render } from "@dxjs/dom";
import { kanban, type KanbanColumn, type KanbanMove } from "../src/index.ts";

const board = (): KanbanColumn[] => [
  { id: "todo", title: "To do", accent: "info", cards: [{ id: "k1", title: "Design", meta: "ana", tags: ["ui"] }, { id: "k2", title: "Spec" }] },
  { id: "doing", title: "Doing", cards: [{ id: "k3", title: "Build" }] },
  { id: "done", title: "Done", cards: [] },
];

const applyMove = (cols: KanbanColumn[], m: KanbanMove): KanbanColumn[] => {
  let moved: KanbanColumn["cards"][number] | undefined;
  const pulled = cols.map((c) => {
    if (c.id !== m.from) return c;
    moved = c.cards.find((k) => k.id === m.card);
    return { ...c, cards: c.cards.filter((k) => k.id !== m.card) };
  });
  return pulled.map((c) =>
    c.id === m.to && moved ? { ...c, cards: [...c.cards.slice(0, m.index), moved, ...c.cards.slice(m.index)] } : c,
  );
};

test("kanban: renders a column per list and a card per item, with counts", () => {
  const host = body();
  render(kanban({ columns: board() }), host);
  assert.equal(host.querySelectorAll(".dx-kb-col").length, 3);
  assert.equal(host.querySelectorAll(".dx-kb-card").length, 3);
  // first column header count is 2
  assert.equal(host.querySelector(".dx-kb-col-count")!.textContent, "2");
  assert.equal(host.querySelector(".dx-kb-card-title")!.textContent, "Design");
  assert.ok(host.querySelector(".dx-kb-tag"));
  assert.equal(host.querySelector(".dx-kb")!.getAttribute("role"), "group");
});

test("kanban: ◀ is disabled in the first column; ▶ reports a move to the next", () => {
  const host = body();
  const cols = signal(board());
  const moves: KanbanMove[] = [];
  render(
    kanban({
      columns: () => cols(),
      onMove: (m) => {
        moves.push(m);
        cols.set(applyMove(cols(), m));
      },
    }),
    host,
  );
  // On a card in the first column, ◀ (previous) is disabled.
  const firstCardMoves = host.querySelector(".dx-kb-card .dx-kb-card-move")!;
  const [prev, next] = [...firstCardMoves.querySelectorAll(".dx-kb-move")];
  assert.ok((prev as unknown as HTMLButtonElement).disabled);
  assert.equal((next as unknown as HTMLButtonElement).disabled, false);

  // Move "Design" (k1) forward: todo → doing at the end.
  fire(next!, "click");
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0], { card: "k1", from: "todo", to: "doing", index: 1 });

  // The board re-rendered from the updated signal: todo now has 1 card, doing has 2.
  const counts = [...host.querySelectorAll(".dx-kb-col-count")].map((n) => n.textContent);
  assert.deepEqual(counts, ["1", "2", "0"]);
});

test("kanban: a card in the last column has ▶ disabled", () => {
  const host = body();
  const cols = signal<KanbanColumn[]>([
    { id: "a", title: "A", cards: [] },
    { id: "b", title: "B", cards: [{ id: "x", title: "X" }] },
  ]);
  render(kanban({ columns: () => cols() }), host);
  const moves = [...host.querySelector(".dx-kb-card .dx-kb-card-move")!.querySelectorAll(".dx-kb-move")];
  // last column → next disabled, prev enabled
  assert.equal((moves[0] as unknown as HTMLButtonElement).disabled, false);
  assert.ok((moves[1] as unknown as HTMLButtonElement).disabled);
});
