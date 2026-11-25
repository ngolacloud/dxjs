import { test } from "node:test";
import assert from "node:assert/strict";

import { soapAdapter, flatXmlCodec, escapeXml, wsdlOperations } from "../src/index.ts";
import { method } from "@dxjs/transport";

test("soapAdapter.unary builds a well-formed envelope and decodes the response", async () => {
  let capturedUrl: string | undefined;
  let capturedBody: string | undefined;
  let capturedHeaders: Record<string, string> | undefined;

  const mockFetch: typeof fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedBody = String(init?.body);
    capturedHeaders = init?.headers as Record<string, string>;
    const reply =
      "<soap:Envelope><soap:Body><GetUserResponse><name>Ana</name></GetUserResponse></soap:Body></soap:Envelope>";
    return new Response(reply, { status: 200, headers: { "content-type": "text/xml" } });
  };

  const transport = soapAdapter({
    endpoint: "https://example.test/soap",
    fetch: mockFetch,
    targetNamespace: "urn:ex",
  });

  const m = method({ id: "GetUser", wire: { soap: { operation: "GetUser", action: "urn:ex/GetUser" } } });
  const result = await transport.unary(m, { id: 7 });

  assert.equal(capturedUrl, "https://example.test/soap");
  assert.ok(capturedBody?.includes('<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'));
  assert.ok(capturedBody?.includes("<soap:Body>"));
  assert.ok(capturedBody?.includes('<GetUser xmlns="urn:ex"><id>7</id></GetUser>'));
  assert.equal(capturedHeaders?.["SOAPAction"], "urn:ex/GetUser");
  assert.equal(capturedHeaders?.["content-type"], "text/xml; charset=utf-8");

  assert.deepEqual(result, { name: "Ana" });
  // The exported default codec decodes the same body directly.
  assert.deepEqual(flatXmlCodec.decode(m, String(capturedBody)), { id: "7" });
});

test("soapAdapter.unary rejects with a transportError on a SOAP Fault", async () => {
  const mockFetch: typeof fetch = async () =>
    new Response(
      "<soap:Envelope><soap:Body><soap:Fault><faultstring>bad</faultstring></soap:Fault></soap:Body></soap:Envelope>",
      { status: 200 },
    );

  const transport = soapAdapter({ endpoint: "https://example.test/soap", fetch: mockFetch });
  const m = method({ id: "DoThing" });

  await assert.rejects(() => transport.unary(m, {}), (err: unknown) => {
    assert.ok(err instanceof Error);
    assert.equal((err as { code?: string }).code, "soap");
    assert.match(err.message, /bad/);
    return true;
  });
});

test("escapeXml escapes & < > \" '", () => {
  assert.equal(escapeXml(`&<>"'`), "&amp;&lt;&gt;&quot;&apos;");
  assert.equal(escapeXml("a & b < c"), "a &amp; b &lt; c");
});

test("wsdlOperations extracts operations and soapAction from a WSDL 1.1 shape", () => {
  const wsdl = `<?xml version="1.0"?>
  <wsdl:definitions xmlns:wsdl="http://schemas.xmlsoap.org/wsdl/"
                    xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/">
    <wsdl:portType name="UserService">
      <wsdl:operation name="GetUser"/>
      <wsdl:operation name="CreateUser"/>
    </wsdl:portType>
    <wsdl:binding name="UserBinding" type="UserService">
      <wsdl:operation name="GetUser">
        <soap:operation soapAction="urn:ex/GetUser"/>
      </wsdl:operation>
      <wsdl:operation name="CreateUser">
        <soap:operation soapAction=""/>
      </wsdl:operation>
    </wsdl:binding>
  </wsdl:definitions>`;

  const ops = wsdlOperations(wsdl);
  assert.deepEqual(Object.keys(ops).sort(), ["CreateUser", "GetUser"]);

  const get = ops["GetUser"]!;
  assert.equal(get.service, "UserService");
  assert.equal((get.wire?.soap as { operation?: string }).operation, "GetUser");
  assert.equal((get.wire?.soap as { action?: string }).action, "urn:ex/GetUser");
  assert.equal(get.idempotent, false);

  const create = ops["CreateUser"]!;
  assert.equal((create.wire?.soap as { operation?: string }).operation, "CreateUser");
  assert.equal((create.wire?.soap as { action?: string }).action, "");
});
