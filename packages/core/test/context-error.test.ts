// Tests for the React-parity additions: createContext/provide/inject (DI by
// construction scope) and onError (error boundaries over the owner tree).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  signal,
  effect,
  createRoot,
  onError,
  createContext,
  provide,
  inject,
} from "../src/index.ts";

test("inject returns the default when nothing is provided", () => {
  const Theme = createContext("light");
  assert.equal(inject(Theme), "light");
});

test("provide makes a value visible to inject during construction", () => {
  const Client = createContext<{ base: string } | null>(null);
  let seen: { base: string } | null = null;
  provide(Client, { base: "/v1" }, () => {
    seen = inject(Client); // read during construction (the documented pattern)
  });
  assert.deepEqual(seen, { base: "/v1" });
  // Restored after provide returns.
  assert.equal(inject(Client), null);
});

test("provide nests: inject reads the innermost value", () => {
  const Ctx = createContext("root");
  const order: string[] = [];
  provide(Ctx, "outer", () => {
    order.push(inject(Ctx)); // outer
    provide(Ctx, "inner", () => order.push(inject(Ctx))); // inner
    order.push(inject(Ctx)); // outer again
  });
  assert.deepEqual(order, ["outer", "inner", "outer"]);
});

test("onError catches an error thrown by a descendant effect", () => {
  const caught: unknown[] = [];
  const boom = signal(false);
  createRoot(() => {
    onError((e) => caught.push(e)); // boundary on this scope
    effect(() => {
      if (boom()) throw new Error("kaboom");
    });
  });
  assert.equal(caught.length, 0, "no error on the first clean run");
  boom.set(true); // triggers the effect to re-run and throw
  assert.equal(caught.length, 1, "the boundary caught the thrown error");
  assert.match(String((caught[0] as Error).message), /kaboom/);
});

test("onError catches an error thrown during an effect's initial run", () => {
  const caught: unknown[] = [];
  createRoot(() => {
    onError((e) => caught.push(e));
    effect(() => {
      throw new Error("at-init");
    });
  });
  assert.equal(caught.length, 1);
  assert.match(String((caught[0] as Error).message), /at-init/);
});

test("without a boundary the error propagates to the caller", () => {
  assert.throws(() => {
    createRoot(() => {
      effect(() => {
        throw new Error("unhandled");
      });
    });
  }, /unhandled/);
});

test("the handler runs untracked (no accidental subscription)", () => {
  const dep = signal(0);
  let runs = 0;
  const boom = signal(true);
  createRoot(() => {
    onError(() => {
      runs++;
      dep(); // reading a signal here must NOT subscribe the handler
    });
    effect(() => {
      if (boom()) throw new Error("x");
    });
  });
  assert.equal(runs, 1);
  dep.set(1); // if the handler had subscribed, this might re-run it
  assert.equal(runs, 1, "handler did not subscribe to signals it read");
});
