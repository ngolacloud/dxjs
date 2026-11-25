// Security regression PoC — M5 (2026-11-25 audit): XML/SOAP injection via
// un-escaped element / operation names. Values were always escaped; tag names were
// interpolated raw, so a hostile request key or operation name could inject arbitrary
// markup into the envelope (break out of the element, add a sibling, forge a Fault).
// The fix validates every element/operation name as an XML Name at the point of
// emission and refuses before any request leaves the client.

import { test } from "node:test";
import assert from "node:assert/strict";

import { soapAdapter, wsdlOperations, isXmlName } from "../src/index.ts";
import { method } from "@dxjs/transport";

/** A fetch that records the body it was asked to send, then returns a benign reply. */
function recordingFetch(): { fetch: typeof fetch; bodies: string[] } {
  const bodies: string[] = [];
  const fetch: typeof fetch = async (_url, init) => {
    bodies.push(String(init?.body));
    const reply = "<soap:Envelope><soap:Body><R><ok>1</ok></R></soap:Body></soap:Envelope>";
    return new Response(reply, { status: 200, headers: { "content-type": "text/xml" } });
  };
  return { fetch, bodies };
}

test("isXmlName accepts real names and rejects markup / whitespace / empty", () => {
  for (const ok of ["GetUser", "a", "_x", "ns:Op", "a.b-c_1"]) assert.equal(isXmlName(ok), true, ok);
  for (const bad of ["x><script", "a b", "a/", 'a"', "a&b", "<a", "", "1abc", "a<b>"]) {
    assert.equal(isXmlName(bad), false, bad);
  }
});

test("M5: a hostile request key is refused before any envelope is sent", async () => {
  const { fetch, bodies } = recordingFetch();
  const transport = soapAdapter({ endpoint: "https://ex.test/soap", fetch });
  const m = method({ id: "Op", wire: { soap: { operation: "Op" } } });

  // Key carries markup: raw interpolation would yield `<x><script>...</x><script>...`.
  await assert.rejects(
    () => transport.unary(m, { ["x><script>alert(1)</script"]: "v" }),
    /invalid XML element name/i,
  );
  assert.equal(bodies.length, 0, "no request must be sent when a name is hostile");
});

test("M5: a hostile operation name is refused before any envelope is sent", async () => {
  const { fetch, bodies } = recordingFetch();
  const transport = soapAdapter({ endpoint: "https://ex.test/soap", fetch });
  const m = method({ id: "Op", wire: { soap: { operation: "Evil><foo xmlns:a='x'" } } });

  await assert.rejects(() => transport.unary(m, { id: 1 }), /invalid XML operation name/i);
  assert.equal(bodies.length, 0);
});

test("M5: a benign call still produces a well-formed envelope (no false positive)", async () => {
  const { fetch, bodies } = recordingFetch();
  const transport = soapAdapter({ endpoint: "https://ex.test/soap", fetch, targetNamespace: "urn:ex" });
  const m = method({ id: "GetUser", wire: { soap: { operation: "GetUser" } } });

  await transport.unary(m, { id: 7, name: "Ana" });
  assert.equal(bodies.length, 1);
  assert.match(bodies[0]!, /<GetUser xmlns="urn:ex"><id>7<\/id><name>Ana<\/name><\/GetUser>/);
  assert.doesNotMatch(bodies[0]!, /<script/i);
});

test("M5: wsdlOperations drops operations whose name is not a valid XML Name", () => {
  // The regex scanner captures the raw attribute value up to the next quote, so a
  // malformed WSDL with raw `<`/`>` in the name yields `Bad><script` as an op name.
  const wsdl = `
    <definitions>
      <portType name="Svc">
        <operation name="GoodOp"/>
        <operation name="Bad><script"/>
      </portType>
    </definitions>`;
  const ops = wsdlOperations(wsdl);
  assert.ok(ops["GoodOp"], "the valid operation survives");
  assert.ok(ops["Bad><script"] === undefined, "the hostile name is dropped, not an invocable descriptor");
  assert.equal(Object.keys(ops).some((k) => k.includes("<") || k.includes(">")), false);
});
