// @dxjs/core/context — lightweight dependency injection by construction scope.
//
// dxjs components run ONCE to build their view, so context is resolved during that
// synchronous construction: `provide(ctx, value, () => buildChildren())` makes
// `value` visible to any `inject(ctx)` called while the children are being built.
// Read it at the top of a component (like React's useContext) and close over the
// result in handlers/effects — that captured value is stable for the component's
// lifetime. No eval, no globals on window, no graph coupling.

/** An injectable value with a default (used when nothing is provided). */
export interface Context<T> {
  readonly id: symbol;
  readonly defaultValue: T;
}

// Per-context value stacks (module-scoped Maps, never on window). A stack lets the
// same context be provided at nested scopes; `inject` reads the innermost.
const stacks = new Map<symbol, unknown[]>();

/** Create a context with a default value. */
export function createContext<T>(defaultValue: T): Context<T> {
  return { id: Symbol("dx-context"), defaultValue };
}

/**
 * Make `value` the current value of `ctx` while `fn` runs (synchronously), then
 * restore the previous value. `inject(ctx)` called inside `fn` sees `value`.
 */
export function provide<T, R>(ctx: Context<T>, value: T, fn: () => R): R {
  let stack = stacks.get(ctx.id);
  if (!stack) {
    stack = [];
    stacks.set(ctx.id, stack);
  }
  stack.push(value);
  try {
    return fn();
  } finally {
    stack.pop();
  }
}

/** Read the current value of `ctx` (the innermost `provide`, else its default). */
export function inject<T>(ctx: Context<T>): T {
  const stack = stacks.get(ctx.id);
  return stack && stack.length ? (stack[stack.length - 1] as T) : ctx.defaultValue;
}
