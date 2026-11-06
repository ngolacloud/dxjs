// @dxjs/forms — signal-reactive forms (the dxjs answer to react-hook-form).
//
// Field values live in a single signal; `errors`, `isValid` and `dirty` are
// computeds derived from them, so the UI updates surgically. Validation is a plain
// `(values) => { field: message }` function — bring your own, or adapt a zod schema
// with `zodValidate(schema)` (duck-typed; @dxjs/forms does NOT depend on zod). No
// eval, no globals; built on @dxjs/core.

import { signal, computed, untrack, type Accessor } from "@dxjs/core";

export type FieldErrors<V> = Partial<Record<keyof V, string>>;
export type Validator<V> = (values: V) => FieldErrors<V>;

export interface FieldBinding<T> {
  value: Accessor<T>;
  /** For text inputs: reads `event.target.value` into the field. */
  onInput: (event: { target: { value: unknown } }) => void;
  /** Marks the field touched (e.g. on blur). */
  onBlur: () => void;
}

export interface Form<V extends Record<string, unknown>> {
  /** Reactive snapshot of all field values. */
  values: Accessor<V>;
  value<K extends keyof V>(name: K): Accessor<V[K]>;
  setValue<K extends keyof V>(name: K, value: V[K]): void;
  /** Reactive validation errors (empty when valid). */
  errors: Accessor<FieldErrors<V>>;
  error<K extends keyof V>(name: K): Accessor<string | undefined>;
  touched<K extends keyof V>(name: K): Accessor<boolean>;
  /** True once any value differs from the initial values. */
  dirty: Accessor<boolean>;
  isValid: Accessor<boolean>;
  /** Handlers for binding a single field to an input. */
  field<K extends keyof V>(name: K): FieldBinding<V[K]>;
  /** Returns a submit handler: marks all fields touched, validates, and calls
   *  `onValid(values)` only when the form is valid. */
  handleSubmit(onValid: (values: V) => void): (event?: { preventDefault?: () => void }) => void;
  /** Restore the initial values and clear touched state. */
  reset(): void;
}

export interface FormOptions<V> {
  initial: V;
  validate?: Validator<V>;
}

/** Create a reactive form over `initial` values with optional `validate`. */
export function createForm<V extends Record<string, unknown>>(options: FormOptions<V>): Form<V> {
  const initial = options.initial;
  const values = signal<V>({ ...initial });
  const touchedMap = signal<Record<string, boolean>>({});

  const errors = computed<FieldErrors<V>>(() => (options.validate ? options.validate(values()) : {}));
  const isValid = computed(() => Object.keys(errors()).length === 0);
  const dirty = computed(() => {
    const v = values();
    return (Object.keys(initial) as Array<keyof V>).some((k) => !Object.is(v[k], initial[k]));
  });

  const setValue = <K extends keyof V>(name: K, value: V[K]): void => {
    values.update((o) => ({ ...o, [name]: value }));
  };
  const touch = (name: keyof V): void => {
    touchedMap.update((t) => (t[name as string] ? t : { ...t, [name as string]: true }));
  };

  return {
    values,
    value: (name) => () => values()[name],
    setValue,
    errors,
    error: (name) => () => errors()[name],
    touched: (name) => () => !!touchedMap()[name as string],
    dirty,
    isValid,
    field: (name) => ({
      value: () => values()[name],
      onInput: (event) => setValue(name, event.target.value as V[typeof name]),
      onBlur: () => touch(name),
    }),
    handleSubmit: (onValid) => (event) => {
      event?.preventDefault?.();
      // Mark everything touched so all errors show after a submit attempt.
      touchedMap.set((Object.keys(initial) as string[]).reduce((t, k) => ((t[k] = true), t), {} as Record<string, boolean>));
      if (untrack(() => isValid())) onValid(untrack(() => values()));
    },
    reset: () => {
      values.set({ ...initial });
      touchedMap.set({});
    },
  };
}

// --- zod adapter (duck-typed; no dependency on zod) ------------------------

/** The slice of a zod schema `@dxjs/forms` uses (so it needn't depend on zod). */
export interface ZodLike<V> {
  safeParse(value: unknown): { success: boolean; error?: { issues: Array<{ path: Array<string | number>; message: string }> } };
  // Phantom to tie the schema to V without importing zod's types.
  readonly _output?: V;
}

/**
 * Adapt a zod (or zod-like) schema into a {@link Validator}: the first issue per
 * top-level field becomes that field's message.
 */
export function zodValidate<V extends Record<string, unknown>>(schema: ZodLike<V>): Validator<V> {
  return (values: V): FieldErrors<V> => {
    const result = schema.safeParse(values);
    if (result.success || !result.error) return {};
    const errors: FieldErrors<V> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as keyof V | undefined;
      if (key !== undefined && errors[key] === undefined) errors[key] = issue.message;
    }
    return errors;
  };
}
