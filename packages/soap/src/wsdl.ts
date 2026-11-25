// @dxjs/soap/wsdl — a small WSDL 1.1 reader that turns a service's operations into
// Transport MethodDescriptors (ADR 0001). It is a bounded regex scan, NOT a full WSDL
// parser: it handles the common WSDL 1.1 shapes (a <portType> listing <operation
// name="…"> and a <binding> carrying <soap:operation soapAction="…"/>), not every
// WSDL variant, import graph, or namespace permutation. No eval, no DOM.

import { method, type MethodDescriptor } from "@dxjs/transport";

export interface WsdlOptions {
  /** Fallback service name when none is found in the document. Defaults to "soap". */
  service?: string;
}

/** Find the portType / service name to use as the descriptor's `service`. */
function findServiceName(xml: string, fallback: string): string {
  const pt = /<(?:\w+:)?portType\b[^>]*\bname\s*=\s*"([^"]+)"/i.exec(xml);
  if (pt) return pt[1]!;
  const svc = /<(?:\w+:)?service\b[^>]*\bname\s*=\s*"([^"]+)"/i.exec(xml);
  if (svc) return svc[1]!;
  return fallback;
}

/** Collect soapAction per operation name from the <binding> block. */
function collectActions(xml: string): Record<string, string> {
  const actions: Record<string, string> = {};
  // Each binding operation: <operation name="X"> … <soap:operation soapAction="Y"/> …
  const opBlock = /<(?:\w+:)?operation\b[^>]*\bname\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/(?:\w+:)?operation>/gi;
  let match: RegExpExecArray | null;
  while ((match = opBlock.exec(xml)) !== null) {
    const name = match[1]!;
    const inner = match[2]!;
    const action = /<(?:\w+:)?operation\b[^>]*\bsoapAction\s*=\s*"([^"]*)"/i.exec(inner);
    if (action) actions[name] = action[1]!;
  }
  // Also catch self-closing binding operations: <operation name="X" ...><soap:operation .../></operation>
  // already covered; additionally scan standalone soap:operation siblings is out of scope.
  return actions;
}

/** Extract operation names declared under the portType. */
function collectOperationNames(xml: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  const portType = /<(?:\w+:)?portType\b[^>]*>([\s\S]*?)<\/(?:\w+:)?portType>/i.exec(xml);
  const scope = portType ? portType[1]! : xml;
  const op = /<(?:\w+:)?operation\b[^>]*\bname\s*=\s*"([^"]+)"/gi;
  let match: RegExpExecArray | null;
  while ((match = op.exec(scope)) !== null) {
    const name = match[1]!;
    if (seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

/**
 * Read a WSDL 1.1 document into MethodDescriptors keyed by operation name.
 * Each descriptor carries `wire.soap = { operation, action }` (action only where a
 * soapAction was found in the binding) and `idempotent: false`.
 */
export function wsdlOperations(wsdlXml: string, opts: WsdlOptions = {}): Record<string, MethodDescriptor> {
  const service = findServiceName(wsdlXml, opts.service ?? "soap");
  const actions = collectActions(wsdlXml);
  const out: Record<string, MethodDescriptor> = {};

  for (const name of collectOperationNames(wsdlXml)) {
    const action = actions[name];
    const soap: { operation: string; action?: string } = { operation: name };
    if (action !== undefined) soap.action = action;
    out[name] = method({
      id: name,
      service,
      method: name,
      wire: { soap },
      idempotent: false,
    });
  }

  return out;
}
