// @dxjs/jsx/jsx-runtime — the TypeScript "automatic" JSX runtime for dxjs.
//
// Configure a project with `"jsx": "react-jsx"` + `"jsxImportSource": "@dxjs/jsx"`
// and `<tags/>` compile to `jsx(type, props, key)` calls here. Each call returns a
// light DESCRIPTOR (see @dxjs/dom `ElementResult`) — NOT a virtual DOM. The one
// renderer in @dxjs/dom realizes it ONCE into real DOM through the same safe sinks
// as html`…` (addEventListener, setAttribute/textContent, reactive effects), so
// there is no eval, no inline handler, no innerHTML of data → strict-CSP safe, and
// JSX interleaves freely with html`…`.
//
// The `JSX` namespace below is what gives editor/tsc type-checking of element
// props and children — the whole point of this package.

import { jsxElement, Fragment } from "@dxjs/dom";
import type { ElementResult, TemplateResult, ListResult } from "@dxjs/dom";

export { Fragment };

/** Create a JSX node. `props` already carries `children`; `key` is accepted for
 *  runtime-signature compatibility and ignored (dxjs keys lists via `list()`). */
export function jsx(type: ElementResult["type"], props: Record<string, unknown> | null): ElementResult {
  return jsxElement(type, props);
}
// Static-children variant — same behaviour for a once-instantiated descriptor.
export { jsx as jsxs };

// --- types: element & attribute surface -----------------------------------

/** A value that may be reactive: pass a plain value or an accessor `() => T`. */
type Reactive<T> = T | (() => T);

/** Anything renderable as a child — including a reactive accessor and a keyed
 *  `list(...)` (ListResult uses `any` to stay assignable regardless of item type). */
type DxChild =
  | JSX.Element
  | ListResult<any>
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | (() => unknown);
type DxChildren = DxChild | DxChild[];

type Handler<E extends Event> = (event: E) => void;

interface DxEvents {
  onClick?: Handler<MouseEvent>;
  onDblClick?: Handler<MouseEvent>;
  onMouseDown?: Handler<MouseEvent>;
  onMouseUp?: Handler<MouseEvent>;
  onMouseEnter?: Handler<MouseEvent>;
  onMouseLeave?: Handler<MouseEvent>;
  onMouseMove?: Handler<MouseEvent>;
  onContextMenu?: Handler<MouseEvent>;
  onPointerDown?: Handler<PointerEvent>;
  onPointerUp?: Handler<PointerEvent>;
  onPointerMove?: Handler<PointerEvent>;
  onKeyDown?: Handler<KeyboardEvent>;
  onKeyUp?: Handler<KeyboardEvent>;
  onInput?: Handler<Event>;
  onChange?: Handler<Event>;
  onSubmit?: Handler<SubmitEvent>;
  onFocus?: Handler<FocusEvent>;
  onBlur?: Handler<FocusEvent>;
  onScroll?: Handler<Event>;
}

/** aria-* and data-* are always allowed on any element. */
interface AriaData {
  [key: `aria-${string}`]: Reactive<string | number | boolean> | undefined;
  [key: `data-${string}`]: Reactive<string | number | boolean> | undefined;
}

/** Common attributes shared by every element. `children`, `ref`, `key`, events. */
interface DxDOMAttributes extends DxEvents {
  children?: DxChildren;
  ref?: (el: Element) => void;
  key?: string | number;
}

interface HTMLAttributes extends DxDOMAttributes, AriaData {
  class?: Reactive<string>;
  className?: Reactive<string>;
  id?: Reactive<string>;
  title?: Reactive<string>;
  role?: Reactive<string>;
  tabindex?: Reactive<number | string>;
  hidden?: Reactive<boolean>;
  slot?: Reactive<string>;
  part?: Reactive<string>;
  style?: string | Record<string, string | number>;
}

interface AnchorAttributes extends HTMLAttributes {
  href?: Reactive<string>;
  target?: Reactive<string>;
  rel?: Reactive<string>;
  download?: Reactive<string>;
}
interface ImgAttributes extends HTMLAttributes {
  src?: Reactive<string>;
  alt?: Reactive<string>;
  width?: Reactive<number | string>;
  height?: Reactive<number | string>;
  loading?: Reactive<"eager" | "lazy">;
}
interface InputAttributes extends HTMLAttributes {
  type?: Reactive<string>;
  value?: Reactive<string | number>;
  checked?: Reactive<boolean>;
  placeholder?: Reactive<string>;
  name?: Reactive<string>;
  disabled?: Reactive<boolean>;
  readonly?: Reactive<boolean>;
  required?: Reactive<boolean>;
  min?: Reactive<number | string>;
  max?: Reactive<number | string>;
  step?: Reactive<number | string>;
  autocomplete?: Reactive<string>;
}
interface ButtonAttributes extends HTMLAttributes {
  type?: Reactive<"button" | "submit" | "reset">;
  disabled?: Reactive<boolean>;
  name?: Reactive<string>;
  value?: Reactive<string | number>;
}
interface LabelAttributes extends HTMLAttributes {
  for?: Reactive<string>;
}
interface FormAttributes extends HTMLAttributes {
  action?: Reactive<string>;
  method?: Reactive<string>;
  novalidate?: Reactive<boolean>;
}
interface OptionAttributes extends HTMLAttributes {
  value?: Reactive<string | number>;
  selected?: Reactive<boolean>;
  disabled?: Reactive<boolean>;
}
interface SelectAttributes extends HTMLAttributes {
  value?: Reactive<string | number>;
  name?: Reactive<string>;
  disabled?: Reactive<boolean>;
  multiple?: Reactive<boolean>;
}
interface TextareaAttributes extends HTMLAttributes {
  value?: Reactive<string>;
  placeholder?: Reactive<string>;
  name?: Reactive<string>;
  rows?: Reactive<number | string>;
  cols?: Reactive<number | string>;
  disabled?: Reactive<boolean>;
  readonly?: Reactive<boolean>;
}

export namespace JSX {
  /** What a component/`jsx()` yields — realized by @dxjs/dom's renderer. */
  export type Element = ElementResult | TemplateResult;
  /** A component is a plain `(props) => Element` function; also a tag string.
   *  Props use `any` here so any component is a valid tag — its real props are
   *  checked against the component's own signature, not against this gate. */
  export type ElementType = string | ((props: any) => Element);
  /** The prop that receives nested children. */
  export interface ElementChildrenAttribute {
    children: object;
  }
  /** Intrinsic props TS always allows (key). */
  export interface IntrinsicAttributes {
    key?: string | number;
  }

  export interface IntrinsicElements {
    a: AnchorAttributes;
    img: ImgAttributes;
    input: InputAttributes;
    button: ButtonAttributes;
    label: LabelAttributes;
    form: FormAttributes;
    option: OptionAttributes;
    select: SelectAttributes;
    textarea: TextareaAttributes;

    div: HTMLAttributes;
    span: HTMLAttributes;
    p: HTMLAttributes;
    section: HTMLAttributes;
    article: HTMLAttributes;
    header: HTMLAttributes;
    footer: HTMLAttributes;
    nav: HTMLAttributes;
    main: HTMLAttributes;
    aside: HTMLAttributes;
    h1: HTMLAttributes;
    h2: HTMLAttributes;
    h3: HTMLAttributes;
    h4: HTMLAttributes;
    h5: HTMLAttributes;
    h6: HTMLAttributes;
    ul: HTMLAttributes;
    ol: HTMLAttributes;
    li: HTMLAttributes;
    table: HTMLAttributes;
    thead: HTMLAttributes;
    tbody: HTMLAttributes;
    tr: HTMLAttributes;
    th: HTMLAttributes;
    td: HTMLAttributes;
    pre: HTMLAttributes;
    code: HTMLAttributes;
    small: HTMLAttributes;
    strong: HTMLAttributes;
    em: HTMLAttributes;
    hr: HTMLAttributes;
    br: HTMLAttributes;
    svg: HTMLAttributes;
    path: HTMLAttributes;

    /** Custom elements / unlisted tags: permissive on the TAG, still typed on
     *  shared attributes. Explicit entries above take precedence. */
    [tag: string]: HTMLAttributes;
  }
}
