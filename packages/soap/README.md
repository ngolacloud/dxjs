# @dxjs/soap

A **SOAP** profile for the [`@dxjs/transport`](../transport) port (ADR 0001).

Everything in dxjs that fetches data depends only on the `Transport` port, never on a
protocol. `@dxjs/soap` is the adapter that speaks SOAP 1.1 / 1.2 behind that port, so
`resource()`, `@dxjs/query` and `@dxjs/forms` reach a SOAP service through the same
seam as REST, Connect/gRPC-web, native gRPC and in-process.

## Install

The `@dxjs/*` packages ship as tarballs on each
[GitHub Release](https://github.com/ngolacloud/dxjs/releases) — the `@dxjs` name
on the npm registry belongs to an unrelated project, so install from the release:

```sh
npm install https://github.com/ngolacloud/dxjs/releases/download/v1.4.0/dxjs-{core,transport,soap}-1.4.0.tgz
```

## Usage

```ts
import { soapAdapter, flatXmlCodec } from "@dxjs/soap";
import { method, createRpcClient } from "@dxjs/transport";

const transport = soapAdapter({
  endpoint: "https://example.com/UserService",
  soapVersion: "1.1",          // default "1.1"
  targetNamespace: "urn:ex",   // xmlns of the operation element
  // codec: flatXmlCodec,       // default; swap for an XML-aware codec in production
});

const client = createRpcClient(transport);

const GetUser = method({
  id: "GetUser",
  wire: { soap: { operation: "GetUser", action: "urn:ex/GetUser" } },
});

const user = await client.call(GetUser, { id: 7 });
```

The adapter POSTs this envelope (request object → flat `<key>value</key>` children,
XML-escaped):

```xml
<?xml version="1.0"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <GetUser xmlns="urn:ex"><id>7</id></GetUser>
  </soap:Body>
</soap:Envelope>
```

- **SOAP 1.1** → `content-type: text/xml; charset=utf-8` and a `SOAPAction` header
  (from `wire.soap.action`, default `""`).
- **SOAP 1.2** → `content-type: application/soap+xml`, no `SOAPAction` header.

A non-OK HTTP status or a `<soap:Fault>` / `<Fault>` in the body throws a
`transportError("soap", …)` carrying the `faultstring` (or `Reason/Text` on 1.2) when
parseable, else the HTTP status.

## Response codec

The adapter builds the envelope; the **response** is parsed by a pluggable `SoapCodec`:

```ts
export interface SoapCodec {
  decode(method: MethodDescriptor, xml: string): unknown;
}
```

The bundled `flatXmlCodec` is a **tiny flat extractor**: it isolates the `<Body>`,
takes the first element (the response wrapper), and reads that wrapper's leaf children
into `{ childTag: textContent }`.

> **Limitation.** `flatXmlCodec` is a *bounded regex scan, not a real XML parser*. It
> assumes a flat response wrapper of leaf text elements (no nesting, no attribute
> content, no repeated tags). For anything richer, supply your own XML-aware
> `SoapCodec`.

## WSDL

`wsdlOperations(wsdlXml)` reads a WSDL 1.1 document into `MethodDescriptor`s keyed by
operation name, carrying `wire.soap = { operation, action }`:

```ts
import { wsdlOperations } from "@dxjs/soap";

const methods = wsdlOperations(wsdlXml);
const user = await client.call(methods["GetUser"], { id: 7 });
```

> **Limitation.** `wsdlOperations` is a bounded regex reader for the common WSDL 1.1
> shapes (a `<portType>` of `<operation name="…">` plus a `<binding>` with
> `<soap:operation soapAction="…"/>`). It does not resolve `<import>`s or cover every
> WSDL variant.

## Capabilities

```ts
{ serverStream: false, bidi: false, binary: false, inProcess: false }
```

SOAP has no native streaming; `serverStream` throws `transportError("unimplemented", …)`.

## Safety

No `eval`, no `new Function`, no `innerHTML`. The envelope is a plain string and all
XML scanning is bounded regex — CSP-safe.

## License

MIT OR Apache-2.0
