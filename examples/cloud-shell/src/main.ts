// Browser entry for the cloud-shell example: mount the app into #app. Kept
// separate from app.ts so the integration test can import mountApp without a DOM
// lookup side effect.
import { mountApp } from "./app.ts";

mountApp(document.getElementById("app")!);
(window as unknown as { __dxready: boolean }).__dxready = true;
