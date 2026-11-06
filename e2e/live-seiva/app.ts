// The dxjs seiva-console, pointed at the SAME origin (a proxy that forwards
// /admin, /openapi.json and /v1 to a real running Seiva admin-e2e backend).
import { mountConsole } from "../../examples/seiva-console/src/index.ts";

mountConsole(document.getElementById("app")!, { baseUrl: "" });
(window as unknown as { __dxready: boolean }).__dxready = true;
