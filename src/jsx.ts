import { apply, fromIterable, of, Stream } from "cancelstream";

import * as Html from "./html";
import map from "cancelstream/ops/map";
import merge from "cancelstream/ops/merge";

import type { AttributeNames } from "./attribute-names";

export type Printable = string | number | boolean;
export type ChildAtom = Printable | Html.Template;
export type ChildType = ChildAtom | Stream<ChildAtom>;

export type AttributeValue = boolean | string | Stream<string | boolean>;

export type Attributes = {
  [name in AttributeNames]: AttributeValue;
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
