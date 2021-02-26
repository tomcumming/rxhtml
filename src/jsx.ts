import { EMPTY, from, isObservable, Observable, of } from "rxjs";
import { combineAll, map, mergeAll, scan } from "rxjs/operators";
import * as Html from "./html";
import * as Frag from "./fragment";

export type AttibuteNames = keyof HTMLElementTagNameMap[keyof HTMLElementTagNameMap];

export type Printable = string | number | boolean;
export type ChildAtom = Printable | Html.Template;
export type ChildStream = ChildAtom | Observable<ChildAtom>;
export type ChildType = ChildStream | ChildStream[];

export type AttributeValue = boolean | string | Observable<string | boolean>;

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
): Observable<Html.AttributeChange> {
  const changes: Observable<Html.AttributeChange>[] = Object.entries(atts).map(
    ([name, values]) =>
      isObservable(values)
        ? values.pipe(
            map((value) => ({
              name,
              value:
                value === false
                  ? Html.REMOVE_ATTRIBUTE
                  : value === true
                  ? ""
                  : value,
            }))
          )
        : of({
            name,
            value:
              values === false
                ? Html.REMOVE_ATTRIBUTE
                : values === true
                ? ""
                : values,
          })
  );

  return from(changes).pipe(mergeAll());
}

function templateFromChildAtom(child: ChildAtom): Html.Template {
  if (typeof child === "object") {
    return child;
  } else if (typeof child === "string") {
    return { text: of(child) };
  } else if (typeof child === "number" || typeof child === "boolean") {
    return { text: of(child.toString()) };
  } else {
    throw new Error(`Unexpected child type`);
  }
}

function templateFromChild(child: ChildType): Html.Template {
  if (Array.isArray(child)) {
    return { fragment: fragmentFromChildren(child) };
  } else if (isObservable(child)) {
    return { fragment: Frag.single(child.pipe(map(templateFromChildAtom))) };
  } else {
    return templateFromChildAtom(child);
  }
}

function fragmentFromChildren(children: ChildType[]): Html.Fragment {
  const templates = children.map(templateFromChild);
  return Frag.fixed(templates);
}

type ElementConstructorArgs =
  | [typeof fragment, ...ChildType[]]
  | [string, null | AttributesMap, ...ChildType[]];

export function element(...args: ElementConstructorArgs): Html.Template {
  if (args[0] === fragment) {
    const [_fragment, ...children] = args;
    return { fragment: fragmentFromChildren(children) };
  } else {
    const [tagName, atts, ...children] = args;
    return {
      element: {
        tagName,
        attributes: atts !== null ? flattenAttributeChanges(atts) : EMPTY,
        body:
          children.length === 0
            ? undefined
            : children.length === 1
            ? templateFromChild(children[0])
            : { fragment: fragmentFromChildren(children) },
      },
    };
  }
}

export const fragment = Symbol("RxHtml Fragment");
