import { apply, fromIterable, of, Stream } from "cancelstream";

import * as Html from "./html";
import map from "cancelstream/ops/map";
import merge from "cancelstream/ops/merge";

export type AttibuteNames = keyof HTMLElementTagNameMap[keyof HTMLElementTagNameMap];

export type Printable = string | number | boolean;
export type ChildAtom = Printable | Html.Template;
export type ChildType = ChildAtom | Stream<ChildAtom>;

export type AttributeValue = boolean | string | Stream<string | boolean>;

// Pinched from https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes
export type Attributes = {
  accept: AttributeValue;
  accesskey: AttributeValue;
  action: AttributeValue;
  align: AttributeValue;
  allow: AttributeValue;
  alt: AttributeValue;
  async: AttributeValue;
  autocapitalize: AttributeValue;
  autocomplete: AttributeValue;
  autofocus: AttributeValue;
  autoplay: AttributeValue;
  buffered: AttributeValue;
  capture: AttributeValue;
  charset: AttributeValue;
  checked: AttributeValue;
  cite: AttributeValue;
  class: AttributeValue;
  code: AttributeValue;
  codebase: AttributeValue;
  cols: AttributeValue;
  colspan: AttributeValue;
  content: AttributeValue;
  contenteditable: AttributeValue;
  contextmenu: AttributeValue;
  controls: AttributeValue;
  coords: AttributeValue;
  crossorigin: AttributeValue;
  csp: AttributeValue;
  data: AttributeValue;
  datetime: AttributeValue;
  decoding: AttributeValue;
  default: AttributeValue;
  defer: AttributeValue;
  dir: AttributeValue;
  dirname: AttributeValue;
  disabled: AttributeValue;
  download: AttributeValue;
  draggable: AttributeValue;
  enctype: AttributeValue;
  enterkeyhint: AttributeValue;
  for: AttributeValue;
  form: AttributeValue;
  formaction: AttributeValue;
  formenctype: AttributeValue;
  formmethod: AttributeValue;
  formnovalidate: AttributeValue;
  formtarget: AttributeValue;
  headers: AttributeValue;
  hidden: AttributeValue;
  high: AttributeValue;
  href: AttributeValue;
  hreflang: AttributeValue;
  icon: AttributeValue;
  id: AttributeValue;
  importance: AttributeValue;
  integrity: AttributeValue;
  itemprop: AttributeValue;
  kind: AttributeValue;
  label: AttributeValue;
  lang: AttributeValue;
  language: AttributeValue;
  list: AttributeValue;
  loop: AttributeValue;
  low: AttributeValue;
  max: AttributeValue;
  maxlength: AttributeValue;
  minlength: AttributeValue;
  media: AttributeValue;
  min: AttributeValue;
  multiple: AttributeValue;
  muted: AttributeValue;
  name: AttributeValue;
  novalidate: AttributeValue;
  open: AttributeValue;
  optimum: AttributeValue;
  pattern: AttributeValue;
  ping: AttributeValue;
  placeholder: AttributeValue;
  poster: AttributeValue;
  preload: AttributeValue;
  readonly: AttributeValue;
  referrerpolicy: AttributeValue;
  rel: AttributeValue;
  required: AttributeValue;
  reversed: AttributeValue;
  rows: AttributeValue;
  rowspan: AttributeValue;
  sandbox: AttributeValue;
  scope: AttributeValue;
  scoped: AttributeValue;
  selected: AttributeValue;
  shape: AttributeValue;
  size: AttributeValue;
  sizes: AttributeValue;
  slot: AttributeValue;
  span: AttributeValue;
  spellcheck: AttributeValue;
  src: AttributeValue;
  srcdoc: AttributeValue;
  srclang: AttributeValue;
  srcset: AttributeValue;
  start: AttributeValue;
  step: AttributeValue;
  style: AttributeValue;
  summary: AttributeValue;
  tabindex: AttributeValue;
  target: AttributeValue;
  title: AttributeValue;
  translate: AttributeValue;
  type: AttributeValue;
  usemap: AttributeValue;
  value: AttributeValue;
  width: AttributeValue;
  wrap: AttributeValue;
};

type LocalIntrinsicElements = {
  [T in keyof HTMLElementTagNameMap]: Partial<Attributes> & {
    children?: ChildType | ChildType[];
  };
};

export namespace JSX {
  export type Element = Html.Template;
  export type ElementChildrenAttribute = { children: {} };
  export type IntrinsicElements = LocalIntrinsicElements;
}

type AttributesMap = { [name: string]: AttributeValue };

function flattenAttributeChanges(
  atts: AttributesMap
): Stream<Html.AttributeChange> {
  function convertSimple(
    value: boolean | string
  ): string | typeof Html.REMOVE_ATTRIBUTE {
    if (typeof value === "boolean") return value ? "" : Html.REMOVE_ATTRIBUTE;
    else return value;
  }

  const changes: Stream<Html.AttributeChange>[] = Object.entries(atts).map(
    ([name, value]) => {
      if (typeof value === "boolean" || typeof value === "string")
        return of({
          name,
          value: convertSimple(value),
        });
      else
        return apply(
          value,
          map((value) => ({ name, value: convertSimple(value) }))
        );
    }
  );

  return apply(fromIterable(changes), merge());
}

function templateFromChild(child: ChildType): Html.Template {
  if (
    typeof child === "boolean" ||
    typeof child === "number" ||
    typeof child === "string"
  )
    return [{ text: child.toString() }];
  else if (Array.isArray(child)) return child;
  else return [{ stream: apply(child, map(templateFromChild)) }];
}

type ElementConstructorArgs =
  | [typeof fragment, ...ChildType[]]
  | [string, null | AttributesMap, ...ChildType[]];

export function element(...args: ElementConstructorArgs): Html.Template {
  if (args[0] === fragment) {
    const [_fragment, atts, ...children] = args;
    if (atts !== null) throw new Error(`Non null atts on fragment`);
    return children.flatMap(templateFromChild);
  } else {
    const [tagName, atts, ...children] = args;
    return [
      {
        element: {
          tagName,
          attributes: atts ? flattenAttributeChanges(atts) : of(),
          body:
            children.length === 0
              ? undefined
              : children.flatMap(templateFromChild),
        },
      },
    ];
  }
}

export const fragment = Symbol("AIHtml Fragment");
