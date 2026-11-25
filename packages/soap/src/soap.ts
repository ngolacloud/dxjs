// @dxjs/soap/soap — a SOAP 1.1/1.2 adapter for the Transport port (ADR 0001).
//
// Like the native-gRPC adapter, the request-building lives in the adapter while the
// RESPONSE shape is produced by a pluggable `codec` — the adapter writes the SOAP
// envelope but a codec parses the reply <Body> into an object, so a backend with an
// idiosyncratic response shape only has to swap the decoder (an XML/WSDL-aware codec
// in production; the bundled `flatXmlCodec` covers simple flat responses). No eval,
// no new Function, no innerHTML: the envelope is a plain string and the default codec
// is a bounded regex scan.

import {
  transportError,
  type Transport,
  type MethodDescriptor,
  type CallCtx,
  type TransportCaps,
} from "@dxjs/transport";

/** Parses a SOAP response body (full envelope XML) into the method's result object. */
export interface SoapCodec {
  decode(method: MethodDescriptor, xml: string): unknown;
}

export interface SoapAdapterOptions {
  /** The SOAP service URL. */
  endpoint: string;
  /** Injectable fetch (tests / non-global environments); defaults to globalThis.fetch. */
  fetch?: typeof fetch;
  /** SOAP binding version; defaults to "1.1". */
  soapVersion?: "1.1" | "1.2";
  /** xmlns applied to the operation element (the body's first child). */
  targetNamespace?: string;
  /** Parses the response <Body> → object; defaults to `flatXmlCodec`. */
  codec?: SoapCodec;
}

/** SOAP hints carried on a descriptor's `wire.soap`. */
interface SoapWire {
  /** The operation (body element) name; defaults to `m.method`. */
  operation?: string;
  /** The SOAPAction header value (SOAP 1.1); defaults to "". */
  action?: string;
}

const CAPS: TransportCaps = { serverStream: false, bidi: false, binary: false, inProcess: false };

const SOAP_NS_11 = "http://schemas.xmlsoap.org/soap/envelope/";
const SOAP_NS_12 = "http://www.w3.org/2003/05/soap-envelope";

/** XML-escape text/attribute content: & < > " '. */
export function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function soapWire(m: MethodDescriptor): SoapWire {
  return (m.wire?.soap ?? {}) as SoapWire;
}

/** Render a flat request object as `<key>escaped-value</key>` children (skips undefined). */
function renderParams(req: unknown): string {
  if (req == null || typeof req !== "object") return "";
  let out = "";
  for (const [key, value] of Object.entries(req as Record<string, unknown>)) {
    if (value === undefined) continue;
    out += `<${key}>${escapeXml(String(value))}</${key}>`;
  }
  return out;
}

/** Build the full SOAP envelope string for an operation. */
function buildEnvelope(opName: string, targetNamespace: string | undefined, soapNs: string, params: string): string {
  const nsAttr = targetNamespace ? ` xmlns="${escapeXml(targetNamespace)}"` : "";
  return (
    `<?xml version="1.0"?>` +
    `<soap:Envelope xmlns:soap="${soapNs}">` +
    `<soap:Body>` +
    `<${opName}${nsAttr}>${params}</${opName}>` +
    `</soap:Body>` +
    `</soap:Envelope>`
  );
}

/** Pull a <faultstring>…</faultstring> (SOAP 1.1) or <Reason><Text>…</Text></Reason>
 *  (SOAP 1.2) out of a fault body, if present. Bounded regex; not a full parser. */
function extractFault(xml: string): string | undefined {
  const fs = /<(?:\w+:)?faultstring[^>]*>([\s\S]*?)<\/(?:\w+:)?faultstring>/i.exec(xml);
  if (fs) return fs[1]!.trim();
  const reason = /<(?:\w+:)?Text[^>]*>([\s\S]*?)<\/(?:\w+:)?Text>/i.exec(xml);
  if (reason) return reason[1]!.trim();
  return undefined;
}

/** Does the body carry a SOAP Fault? (Matches `<soap:Fault>` / `<Fault>` / any prefix.) */
function hasFault(xml: string): boolean {
  return /<(?:\w+:)?Fault[\s>]/i.test(xml);
}

/**
 * Default codec: a tiny FLAT extractor. It finds the first element inside the SOAP
 * Body (the response wrapper), then reads that wrapper's direct simple children into
 * `{ childTag: textContent }`.
 *
 * LIMITATION: this is a bounded regex scan, NOT a real XML parser. It assumes a flat
 * response wrapper whose children are leaf text elements (no nesting, no attributes
 * of interest, no repeated tags, no namespaces on the leaves). Anything richer needs
 * a proper XML-aware `SoapCodec`.
 */
export const flatXmlCodec: SoapCodec = {
  decode(_method: MethodDescriptor, xml: string): unknown {
    // Isolate the <Body>…</Body> content (any namespace prefix).
    const body = /<(?:\w+:)?Body[^>]*>([\s\S]*?)<\/(?:\w+:)?Body>/i.exec(xml);
    const inner = body ? body[1]! : xml;
    // The response wrapper is the first element inside the Body.
    const wrapper = /<(?:\w+:)?([A-Za-z_][\w.-]*)[^>]*>([\s\S]*?)<\/(?:\w+:)?\1>/.exec(inner);
    const content = wrapper ? wrapper[2]! : inner;
    const result: Record<string, string> = {};
    const child = /<(?:\w+:)?([A-Za-z_][\w.-]*)[^>]*>([\s\S]*?)<\/(?:\w+:)?\1>/g;
    let match: RegExpExecArray | null;
    while ((match = child.exec(content)) !== null) {
      const tag = match[1]!;
      const text = match[2]!;
      // Only capture leaf elements (no further nested element in their text).
      if (/<[A-Za-z_]/.test(text)) continue;
      result[tag] = unescapeXml(text.trim());
    }
    return result;
  },
};

/** Reverse of escapeXml for the small set of entities the flat codec emits/reads. */
function unescapeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

/** A SOAP adapter over the Transport port. Unary only (SOAP has no native streaming). */
export function soapAdapter(options: SoapAdapterOptions): Transport {
  const version = options.soapVersion ?? "1.1";
  const soapNs = version === "1.2" ? SOAP_NS_12 : SOAP_NS_11;
  const codec = options.codec ?? flatXmlCodec;
  const doFetch = options.fetch ?? globalThis.fetch;

  return {
    caps: CAPS,
    async unary<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx: CallCtx = {}): Promise<Res> {
      const wire = soapWire(m);
      const opName = wire.operation ?? m.method;
      const params = renderParams(req);
      const envelope = buildEnvelope(opName, options.targetNamespace, soapNs, params);

      const headers: Record<string, string> = {
        "content-type": version === "1.2" ? "application/soap+xml" : "text/xml; charset=utf-8",
        ...(ctx.meta ?? {}),
      };
      if (version === "1.1") headers["SOAPAction"] = wire.action ?? "";

      const res = await doFetch(options.endpoint, {
        method: "POST",
        headers,
        body: envelope,
        signal: ctx.signal,
      });
      const text = await res.text();

      if (!res.ok || hasFault(text)) {
        const message = extractFault(text) ?? `HTTP ${res.status}`;
        throw transportError("soap", message);
      }
      return codec.decode(m, text) as Res;
    },
    serverStream(): AsyncIterable<never> {
      throw transportError("unimplemented", "soapAdapter: SOAP has no native server streaming");
    },
  };
}
