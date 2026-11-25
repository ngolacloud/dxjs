// AUDIT PoC — H1 (ALTO): URL-scheme injection (javascript:/data:) in navigation
// attributes. The renderer pipes data into setAttribute("href"/"src"/…) without
// validating the scheme, so a data-controlled value like "javascript:…" survives
// and executes on click. This test asserts the SAFE behaviour (scheme neutralised);
// it fails against the pre-fix renderer and passes once H1 is fixed.
import { body } from "./setup.ts";
import { test } from "node:test";
import assert from "node:assert/strict";
import { signal } from "@dxjs/core";
import { html, render } from "../src/index.ts";

test("H1: javascript: URL in href is neutralised, not reflected", () => {
  const host = body();
  const url = signal("javascript:globalThis.__h1_click = 1");
  render(html`<a href=${() => url()}>open</a>`, host);
  const href = host.querySelector("a")!.getAttribute("href") ?? "";
  assert.ok(
    !/^\s*javascript:/i.test(href),
    `href must not carry a javascript: URL — got: ${JSON.stringify(href)}`,
  );
});

test("H1: data: URL in an iframe src is neutralised", () => {
  const host = body();
  const src = signal("data:text/html,<script>globalThis.__h1_frame=1</script>");
  render(html`<iframe src=${() => src()}></iframe>`, host);
  const got = host.querySelector("iframe")!.getAttribute("src") ?? "";
  assert.ok(
    !/^\s*data:/i.test(got),
    `iframe src must not carry a data: URL — got: ${JSON.stringify(got)}`,
  );
});

test("H1: ordinary http(s) and relative URLs still pass through untouched", () => {
  const host = body();
  render(html`<a href=${"https://ngolacloud.ao/x"}>a</a><a href=${"/local/path"}>b</a>`, host);
  const hrefs = [...host.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs, ["https://ngolacloud.ao/x", "/local/path"]);
});
