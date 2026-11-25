// @dxjs/openapi/schema — a minimal JSON-Schema → validator compiler. It produces a
// function with the @dxjs/forms `Validator` shape (values → { field: message }), so
// client-side validation mirrors the server's OpenAPI request schema. Scope: the
// object's own properties (one level), `required`, type, `format: email`, `pattern`,
// min/maxLength, minimum/maximum, `enum`, and `$ref` into components.schemas.

export type JsonType = "object" | "string" | "number" | "integer" | "boolean" | "array" | "null";

export interface JsonSchema {
  type?: JsonType | JsonType[];
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: unknown[];
  format?: string;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  nullable?: boolean;
  $ref?: string;
}

/** Resolve a `$ref` (e.g. "#/components/schemas/User") to a schema, or undefined. */
export type Resolver = (ref: string) => JsonSchema | undefined;

/** The @dxjs/forms-compatible validator shape. */
export type SchemaValidator = (values: Record<string, unknown>) => Record<string, string>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function deref(s: JsonSchema, resolve: Resolver, depth = 0): JsonSchema {
  if (s.$ref && depth < 10) {
    const target = resolve(s.$ref);
    if (target) return deref(target, resolve, depth + 1);
  }
  return s;
}

function matchesType(ty: JsonType, value: unknown): boolean {
  switch (ty) {
    case "string": return typeof value === "string";
    case "number": return typeof value === "number" && Number.isFinite(value);
    case "integer": return typeof value === "number" && Number.isInteger(value);
    case "boolean": return typeof value === "boolean";
    case "array": return Array.isArray(value);
    case "null": return value === null;
    case "object": return typeof value === "object" && value !== null && !Array.isArray(value);
    default: return true;
  }
}

/** First validation error for one value against one schema, or null if valid. */
function checkValue(schema: JsonSchema, value: unknown): string | null {
  const types = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
  if (types.length && !types.some((t) => matchesType(t, value))) {
    return `must be ${types.join(" or ")}`;
  }
  if (typeof value === "string") {
    if (schema.minLength != null && value.length < schema.minLength) return `must be at least ${schema.minLength} characters`;
    if (schema.maxLength != null && value.length > schema.maxLength) return `must be at most ${schema.maxLength} characters`;
    if (schema.format === "email" && !EMAIL.test(value)) return "must be a valid email";
    if (schema.pattern) {
      let re: RegExp | null = null;
      try {
        re = new RegExp(schema.pattern);
      } catch {
        re = null; // an unparseable server pattern is not a client error
      }
      if (re && !re.test(value)) return "has an invalid format";
    }
  }
  if (typeof value === "number") {
    if (schema.minimum != null && value < schema.minimum) return `must be ≥ ${schema.minimum}`;
    if (schema.maximum != null && value > schema.maximum) return `must be ≤ ${schema.maximum}`;
  }
  if (schema.enum && !schema.enum.includes(value)) return `must be one of: ${schema.enum.join(", ")}`;
  return null;
}

/** Compile an object schema into a @dxjs/forms validator. */
export function compileValidator(schema: JsonSchema, resolve: Resolver = () => undefined): SchemaValidator {
  const root = deref(schema, resolve);
  const props = root.properties ?? {};
  const required = new Set(root.required ?? []);
  return (values) => {
    const errors: Record<string, string> = {};
    const v = values ?? {};
    for (const key of Object.keys(props)) {
      const sub = deref(props[key]!, resolve);
      const val = (v as Record<string, unknown>)[key];
      const missing = val === undefined || val === null || val === "";
      if (required.has(key) && missing) {
        errors[key] = "is required";
        continue;
      }
      if (missing) continue; // optional + empty → fine
      const msg = checkValue(sub, val);
      if (msg) errors[key] = msg;
    }
    return errors;
  };
}
