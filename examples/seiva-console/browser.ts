// Production browser entry for the dxjs Seiva console: mount into #app and talk
// to the SAME origin (the Seiva backend serves this bundle at /admin/dx, so
// /admin/registry.json and /openapi.json are same-origin). Bundled (esbuild) and
// vendored into the Rust crate seiva-console-admin per Seiva ADR 0016.
import { mountConsole } from "./src/index.ts";

mountConsole(document.getElementById("app")!, { baseUrl: "" });
