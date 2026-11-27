// Browser entry for the ui-gallery example: mount the gallery into #app. Kept
// separate from app.ts so a test could import mountApp without the DOM lookup
// side effect.
import { mountApp } from "./app.ts";

mountApp(document.getElementById("app")!);
(window as unknown as { __dxready: boolean }).__dxready = true;
