# @dxjs/forms

Signal-reactive forms for dxjs — the dxjs answer to react-hook-form. Field values
live in a signal; `errors`, `isValid` and `dirty` are computeds derived from them.
Validate with a plain function, or adapt a **zod** schema via `zodValidate` (duck-
typed — no dependency on zod). Built on `@dxjs/core`.

```ts
import { createForm, zodValidate } from "@dxjs/forms";

const f = createForm({
  initial: { email: "", password: "" },
  validate: zodValidate(LoginSchema), // or (values) => ({ field: "message" })
});

const submit = f.handleSubmit((values) => save(values)); // runs only when valid

// bind a field:
html`<input @input=${f.field("email").onInput} @blur=${f.field("email").onBlur} />
     ${() => f.touched("email")() && f.error("email")()}`;
```

- `f.values()` · `f.value(name)` · `f.setValue(name, v)` · `f.dirty()` · `f.isValid()`
- `f.field(name)` → `{ value, onInput, onBlur }`
- `f.handleSubmit(onValid)` marks all fields touched, validates, then calls `onValid`.
- `f.reset()` restores the initial values and clears touched.
