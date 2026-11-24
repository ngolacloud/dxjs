// @dxjs/component/element — wrap a dxjs component as a Web Component (custom
// element). The element mounts the component into itself on connect and tears it
// down on disconnect; declared `attributes` flow in as REACTIVE props (string
// accessors backed by signals), so an attribute change re-renders surgically.
//
// Light DOM by default (so the app's same-origin ui.css applies and it stays
// strict-CSP safe — mount/render only, no eval, no inline). This is the optional
// interop path from DESIGN.md §D2: author in dxjs, consume as <dx-foo> anywhere.

import { signal, type Accessor } from "@dxjs/core";
import { mount, type Component } from "./index.ts";

export interface DefineElementOptions {
  /** Attribute names to observe and forward as reactive props (camelCased). */
  attributes?: string[];
  /** Render into a shadow root instead of the light DOM. Default false. */
  shadow?: boolean | ShadowRootInit;
}

/** Props a `defineElement` component receives: one string accessor per observed
 *  attribute (keyed camelCase), reading the live attribute value. */
export type ElementProps = Record<string, Accessor<string | null>>;

function camelCase(attr: string): string {
  return attr.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase());
}

/**
 * Register `component` as the custom element `tag`. Idempotent: re-defining the
 * same tag (or a tag already registered elsewhere) is a no-op.
 */
export function defineElement(
  tag: string,
  component: Component<ElementProps>,
  options: DefineElementOptions = {},
): void {
  const registry = (globalThis as { customElements?: CustomElementRegistry }).customElements;
  if (!registry || registry.get(tag)) return;
  const attrs = options.attributes ?? [];
  const shadow = options.shadow;

  class DxElement extends HTMLElement {
    static get observedAttributes(): string[] {
      return attrs;
    }
    private sigs = new Map<string, ReturnType<typeof signal<string | null>>>();
    private dispose: (() => void) | null = null;

    constructor() {
      super();
      // Create the backing signals up front so attributeChangedCallback (which can
      // fire during upgrade, before connect) always has a target.
      for (const a of attrs) this.sigs.set(a, signal<string | null>(null));
    }

    connectedCallback(): void {
      for (const a of attrs) this.sigs.get(a)!.set(this.getAttribute(a));
      const props: ElementProps = {};
      for (const [a, s] of this.sigs) props[camelCase(a)] = () => s();
      const host: Element = shadow
        ? (this.attachShadow(typeof shadow === "object" ? shadow : { mode: "open" }) as unknown as Element)
        : this;
      this.dispose = mount(component, host, props);
    }

    attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
      this.sigs.get(name)?.set(value);
    }

    disconnectedCallback(): void {
      this.dispose?.();
      this.dispose = null;
    }
  }

  registry.define(tag, DxElement);
}
