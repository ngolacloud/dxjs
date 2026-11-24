# Versioning & stability

dxjs follows [Semantic Versioning 2.0.0](https://semver.org). Every `@dxjs/*`
package shares one version line and is released together.

## What the version protects

The **public API** of each package — the named exports documented in its README
and `src/index.ts`, and their TypeScript types — is the contract. Within a major:

- **patch** (`x.y.Z`): bug fixes, docs, internal refactors; no API change.
- **minor** (`x.Y.z`): additive — new exports/options/overloads; existing code
  keeps compiling and behaving.
- **major** (`X.y.z`): a breaking change to a public export or its types.

Not covered by semver (may change in any release): anything marked
`@internal`/not exported from `index.ts`, the exact HTML/whitespace of SSR output,
bundle byte sizes, and dev-only tooling behaviour (`@dxjs/dev`, `@dxjs/devtools`
internals beyond their documented API).

## Hard invariants (never broken, any version)

These are the project's reason to exist and are treated as part of every
package's contract:

- **No `eval` / `new Function` / inline handlers** anywhere in shipped source
  (enforced by `gate:no-eval`).
- **Strict-CSP safe**: runs under `script-src 'self'; style-src 'self'` with no
  `unsafe-eval`/`unsafe-inline`.
- **Deterministic teardown**: every effect/computed/root is owned and disposable.
- **Data is escaped**: no `innerHTML` of data; output goes through safe DOM sinks.

## The 0.x → 1.0 path

While `0.x`, a **minor** may carry a breaking change (semver's 0.x allowance), but
we avoid it and call it out in the changelog. 1.0 is cut when:

1. The package surfaces are stable (no planned breaking changes to core/dom/
   component/server/transport/ui).
2. Each public export has docs + a test, and `npm run check` is green.
3. The size budgets (`gate:size`) and `gate:no-eval` hold.

After 1.0, breaking changes require a major bump and a migration note.
