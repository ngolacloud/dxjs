// @dxjs/soap — public surface: the SOAP adapter for the Transport port (ADR 0001),
// its default flat response codec, an XML-escape helper, and a small WSDL reader.

export { soapAdapter, flatXmlCodec, escapeXml } from "./soap.ts";
export type { SoapCodec, SoapAdapterOptions } from "./soap.ts";

export { wsdlOperations } from "./wsdl.ts";
export type { WsdlOptions } from "./wsdl.ts";
