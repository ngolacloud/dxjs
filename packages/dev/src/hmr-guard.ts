// @dxjs/dev — HMR update guard (pure, no browser/node API → unit-testable).
//
// The HMR client dynamic-`import()`s the `path` the dev server sends. Under strict
// CSP (`script-src 'self'`) only a same-origin module can load, but the client must
// not trust the server message blindly: a `path` is accepted ONLY if it is a plain
// same-origin dev module URL (`/@fs/…` or `/@app/…`) with no scheme or
// protocol-relative prefix, and the version must be a finite number. (Audit L13)

/** True if `path` is a same-origin dev module URL safe to dynamic-import. */
export function isTrustedModuleUrl(path: unknown): path is string {
  return (
    typeof path === "string" &&
    (path.startsWith("/@fs/") || path.startsWith("/@app/")) &&
    !path.includes("://") && // no absolute URL smuggled in
    !path.startsWith("//") && // no protocol-relative host
    !path.includes("\\") && // no backslash tricks
    !path.includes("\0")
  );
}

/** True if `version` is a finite, non-negative cache-busting number. */
export function isValidVersion(version: unknown): version is number {
  return typeof version === "number" && Number.isFinite(version) && version >= 0;
}
