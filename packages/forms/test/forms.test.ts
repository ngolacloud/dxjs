import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoot } from "@dxjs/core";
import { createForm, zodValidate } from "../src/index.ts";

interface Login extends Record<string, unknown> {
  email: string;
  password: string;
}

test("values, setValue and dirty track edits", () => {
  createRoot(() => {
    const f = createForm<Login>({ initial: { email: "", password: "" } });
    assert.deepEqual(f.values(), { email: "", password: "" });
    assert.equal(f.dirty(), false);
    f.setValue("email", "a@b.co");
    assert.equal(f.value("email")(), "a@b.co");
    assert.equal(f.dirty(), true);
  });
});

test("validate drives reactive errors + isValid", () => {
  createRoot(() => {
    const f = createForm<Login>({
      initial: { email: "", password: "" },
      validate: (v) => {
        const e: Partial<Record<keyof Login, string>> = {};
        if (!v.email.includes("@")) e.email = "invalid email";
        if (v.password.length < 6) e.password = "too short";
        return e;
      },
    });
    assert.equal(f.isValid(), false);
    assert.equal(f.error("email")(), "invalid email");
    f.setValue("email", "x@y.z");
    f.setValue("password", "secret!");
    assert.equal(f.error("email")(), undefined);
    assert.equal(f.isValid(), true);
  });
});

test("field() binding: onInput writes, onBlur marks touched", () => {
  createRoot(() => {
    const f = createForm<Login>({ initial: { email: "", password: "" } });
    const fld = f.field("email");
    assert.equal(f.touched("email")(), false);
    fld.onInput({ target: { value: "typed@it.in" } });
    assert.equal(f.value("email")(), "typed@it.in");
    fld.onBlur();
    assert.equal(f.touched("email")(), true);
  });
});

test("handleSubmit: blocks invalid (touches all), runs on valid", () => {
  createRoot(() => {
    const f = createForm<Login>({
      initial: { email: "", password: "" },
      validate: (v) => (v.email ? {} : { email: "required" }),
    });
    let submitted: Login | null = null;
    const submit = f.handleSubmit((v) => (submitted = v));
    let prevented = false;
    submit({ preventDefault: () => (prevented = true) });
    assert.equal(prevented, true);
    assert.equal(submitted, null, "invalid form did not submit");
    assert.equal(f.touched("email")(), true, "submit marks fields touched");

    f.setValue("email", "ok@ok.ok");
    submit();
    assert.deepEqual(submitted, { email: "ok@ok.ok", password: "" });
  });
});

test("zodValidate maps the first issue per field (duck-typed schema)", () => {
  // A fake zod-like schema (no zod dependency): reproduces safeParse's shape.
  const schema = {
    safeParse(v: unknown) {
      const val = v as Login;
      const issues: Array<{ path: Array<string | number>; message: string }> = [];
      if (!val.email.includes("@")) issues.push({ path: ["email"], message: "Invalid email" });
      if (val.password.length < 6) issues.push({ path: ["password"], message: "Min 6 chars" });
      return issues.length ? { success: false, error: { issues } } : { success: true };
    },
  };
  createRoot(() => {
    const f = createForm<Login>({ initial: { email: "", password: "" }, validate: zodValidate<Login>(schema) });
    assert.equal(f.error("email")(), "Invalid email");
    assert.equal(f.error("password")(), "Min 6 chars");
    f.setValue("email", "good@x.io");
    f.setValue("password", "longenough");
    assert.equal(f.isValid(), true);
  });
});

test("reset restores initial values and clears touched", () => {
  createRoot(() => {
    const f = createForm<Login>({ initial: { email: "x@y.z", password: "" } });
    f.setValue("email", "changed@a.b");
    f.field("email").onBlur();
    f.reset();
    assert.equal(f.value("email")(), "x@y.z");
    assert.equal(f.touched("email")(), false);
    assert.equal(f.dirty(), false);
  });
});
