// Regression: a keyed list() row owns its reactive bindings for as long as the
// row lives. Before the fix, every row's effects were owned by the list's own
// effect, so the first change to the list disposed the bindings of the rows it
// KEPT — their text/attributes went dead (event handlers kept working).
import { body, fire } from "./setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal, type Signal } from "@dxjs/core";
import { html, list, render, jsxElement } from "../src/index.ts";

interface Row {
  id: string;
  label: Signal<string>;
}

const row = (id: string, label = id.toUpperCase()): Row => ({ id, label: signal(label) });
const li = (host: Element, k: string): Element | null => host.querySelector(`[data-k="${k}"]`);
const text = (host: Element, k: string): string | null => li(host, k)?.textContent ?? null;

function setup(initial: Row[]) {
  const host = body();
  const items = signal<Row[]>(initial);
  const runs = new Map<string, number>();
  const dispose = render(
    html`<ul>${list(
      () => items(),
      (r) => r.id,
      (r) => html`<li data-k=${r.id} title=${() => r.label()}>${() => {
        runs.set(r.id, (runs.get(r.id) ?? 0) + 1);
        return r.label();
      }}</li>`,
    )}</ul>`,
    host,
  );
  return { host, items, runs, dispose };
}

test("a kept row's text binding still updates after the list changes", () => {
  const a = row("a");
  const b = row("b");
  const { host, items, dispose } = setup([a, b]);
  items.set([a, b, row("c")]); // the list changes; a and b are kept
  a.label.set("A2");
  assert.equal(text(host, "a"), "A2", "kept row 'a' text follows its signal");
  b.label.set("B2");
  assert.equal(text(host, "b"), "B2", "kept row 'b' text follows its signal");
  dispose();
});

test("a kept row's attribute binding still updates after the list changes", () => {
  const a = row("a");
  const { host, items, dispose } = setup([a, row("b")]);
  items.set([a]); // b removed, a kept
  a.label.set("A2");
  assert.equal(li(host, "a")!.getAttribute("title"), "A2");
  dispose();
});

test("reordering keeps every row's bindings alive (and the same nodes)", () => {
  const a = row("a");
  const b = row("b");
  const c = row("c");
  const { host, items, dispose } = setup([a, b, c]);
  const liA = li(host, "a");
  items.set([c, a, b]);
  items.set([b, c, a]);
  assert.equal(li(host, "a"), liA, "row 'a' is the same DOM node");
  a.label.set("A2");
  b.label.set("B2");
  c.label.set("C2");
  assert.deepEqual(
    [...host.querySelectorAll("li")].map((n) => n.textContent),
    ["B2", "C2", "A2"],
  );
  dispose();
});

test("a removed row's bindings are disposed — no update after removal", () => {
  const a = row("a");
  const b = row("b");
  const { host, items, runs, dispose } = setup([a, b]);
  const liB = li(host, "b")!;
  items.set([a]);
  const before = runs.get("b");
  b.label.set("B2");
  assert.equal(runs.get("b"), before, "removed row's effect does not re-run");
  assert.notEqual(liB.textContent, "B2", "detached row node is not written to");
  assert.equal(liB.isConnected, false);
  // The kept row is unaffected by the removal.
  a.label.set("A2");
  assert.equal(text(host, "a"), "A2");
  dispose();
});

test("re-adding a removed key renders a fresh, live row", () => {
  const a = row("a");
  const b = row("b");
  const { host, items, dispose } = setup([a, b]);
  items.set([a]);
  items.set([a, b]);
  b.label.set("B2");
  assert.equal(text(host, "b"), "B2");
  dispose();
});

test("disposing the list disposes every row's bindings", () => {
  const a = row("a");
  const b = row("b");
  const { host, items, runs, dispose } = setup([a, b]);
  items.set([a, b, row("c")]);
  const ra = runs.get("a");
  const rb = runs.get("b");
  dispose();
  a.label.set("A2");
  b.label.set("B2");
  assert.equal(runs.get("a"), ra, "row 'a' effect disposed with the list");
  assert.equal(runs.get("b"), rb, "row 'b' effect disposed with the list");
  assert.equal(host.querySelectorAll("li").length, 0);
});

test("disposing a top-level list removes rows added after mount", () => {
  const host = body();
  const items = signal<Row[]>([row("a")]);
  const dispose = render(
    html`${list(() => items(), (r) => r.id, (r) => html`<li data-k=${r.id}>${() => r.label()}</li>`)}`,
    host,
  );
  items.set([...items(), row("b")]);
  assert.equal(host.querySelectorAll("li").length, 2);
  dispose();
  assert.equal(host.innerHTML, "", "no row is left behind in the host");
});

test("a kept row only re-runs its own binding — the list does not re-render it", () => {
  const a = row("a");
  const b = row("b");
  const { items, runs, dispose } = setup([a, b]);
  items.set([a, b, row("c")]);
  assert.equal(runs.get("a"), 1, "adding a row does not re-run kept rows' bindings");
  a.label.set("A2");
  assert.equal(runs.get("a"), 2);
  assert.equal(runs.get("b"), 1, "a sibling's signal does not touch this row");
  dispose();
});

test("signals read while rendering a row do not subscribe the list", () => {
  const host = body();
  const a = row("a");
  const items = signal<Row[]>([a, row("b")]);
  let listRuns = 0;
  const dispose = render(
    html`<ul>${list(
      () => {
        listRuns++;
        return items();
      },
      (r) => r.id,
      // `r.label()` read eagerly (a static snapshot), plus a live binding.
      (r) => html`<li data-k=${r.id} data-first=${r.label()}>${() => r.label()}</li>`,
    )}</ul>`,
    host,
  );
  assert.equal(listRuns, 1);
  a.label.set("A2");
  assert.equal(listRuns, 1, "an eager read inside render does not re-run the list");
  assert.equal(text(host, "a"), "A2", "the row's live binding updated");
  assert.equal(li(host, "a")!.getAttribute("data-first"), "A", "the eager read is a snapshot");
  dispose();
});

test("event handlers and bindings of a kept row both keep working", () => {
  const host = body();
  const a = row("a");
  const items = signal<Row[]>([a]);
  const dispose = render(
    html`<ul>${list(
      () => items(),
      (r) => r.id,
      (r) => html`<li data-k=${r.id} @click=${() => r.label.set(r.label() + "!")}>${() => r.label()}</li>`,
    )}</ul>`,
    host,
  );
  items.set([a, row("b")]);
  fire(li(host, "a")!, "click");
  assert.equal(text(host, "a"), "A!");
  dispose();
});

test("nested keyed lists: inner rows stay live across outer and inner changes", () => {
  interface Group {
    id: string;
    rows: Signal<Row[]>;
  }
  const host = body();
  const x = row("x");
  const y = row("y");
  const g1: Group = { id: "g1", rows: signal([x]) };
  const g2: Group = { id: "g2", rows: signal([y]) };
  const groups = signal<Group[]>([g1, g2]);
  let innerRuns = 0;
  const dispose = render(
    html`<div>${list(
      () => groups(),
      (g) => g.id,
      (g) => html`<ul data-g=${g.id}>${list(
        () => g.rows(),
        (r) => r.id,
        (r) => html`<li data-k=${r.id}>${() => {
          innerRuns++;
          return r.label();
        }}</li>`,
      )}</ul>`,
    )}</div>`,
    host,
  );

  // Outer change: g1 kept, a new group added.
  groups.set([g1, g2, { id: "g3", rows: signal([row("z")]) }]);
  x.label.set("X2");
  assert.equal(text(host, "x"), "X2", "inner row of a kept group survives an outer change");

  // Inner change: x kept, w added.
  g1.rows.set([x, row("w")]);
  x.label.set("X3");
  assert.equal(text(host, "x"), "X3", "kept inner row survives an inner change");

  // Removing a whole group disposes its inner rows.
  groups.set([g1]);
  const runs = innerRuns;
  y.label.set("Y2");
  assert.equal(innerRuns, runs, "inner rows of a removed group are disposed");
  assert.equal(host.querySelector('[data-g="g2"]'), null);

  dispose();
  x.label.set("X4");
  assert.equal(innerRuns, runs, "disposing the outer list disposes nested rows");
});

test("a list inside a reactive (non-keyed) child: kept rows live, swapped-out list disposed", () => {
  const host = body();
  const a = row("a");
  const items = signal<Row[]>([a]);
  const show = signal(true);
  let rowRuns = 0;
  const dispose = render(
    html`<section>${() =>
      show()
        ? html`<ul>${list(
            () => items(),
            (r) => r.id,
            (r) => html`<li data-k=${r.id}>${() => {
              rowRuns++;
              return r.label();
            }}</li>`,
          )}</ul>`
        : "hidden"}</section>`,
    host,
  );
  items.set([a, row("b")]);
  a.label.set("A2");
  assert.equal(text(host, "a"), "A2");
  show.set(false);
  const runs = rowRuns;
  a.label.set("A3");
  assert.equal(rowRuns, runs, "rows are disposed when the enclosing slot swaps the list out");
  assert.equal(host.textContent, "hidden");
  dispose();
});

test("non-keyed array child: rebuilt rows are live after every change", () => {
  const host = body();
  const a = row("a");
  const items = signal<Row[]>([a]);
  const dispose = render(
    html`<ul>${() => items().map((r) => html`<li data-k=${r.id}>${() => r.label()}</li>`)}</ul>`,
    host,
  );
  items.set([a, row("b")]);
  a.label.set("A2");
  assert.equal(text(host, "a"), "A2");
  dispose();
  a.label.set("A3");
  assert.equal(host.querySelectorAll("li").length, 0);
});

test("JSX path: a keyed list's kept rows stay live", () => {
  const host = body();
  const a = row("a");
  const items = signal<Row[]>([a]);
  const dispose = render(
    jsxElement("ul", {
      children: list(
        () => items(),
        (r) => r.id,
        (r) => html`<li data-k=${r.id}>${() => r.label()}</li>`,
      ),
    }),
    host,
  );
  items.set([a, row("b")]);
  a.label.set("A2");
  assert.equal(text(host, "a"), "A2");
  dispose();
});
