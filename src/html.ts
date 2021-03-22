import { Stream } from "cancelstream";

// TODO work this out properly, maybe copy lit-html
const attributeMatcher = /(?:\s|^)([\w-]+)\s*=\s*$/mu;

type TemplateValuePart =
  | { attribute: string; value: unknown }
  | { child: TemplateChild };

export type TemplateStringlike = string | number | boolean;

export type TemplateChildAtom = TemplateStringlike | Template;

export const DYNAMIC_LIST = Symbol("HTMLSTREAM Dynamic List");

export type DynamicListChange =
  | { insert: number; template: TemplateChildAtom }
  | { remove: number };

export type DynamicList = {
  [DYNAMIC_LIST]: Stream<DynamicListChange>;
};

export type TemplateChild =
  | TemplateChildAtom
  | Stream<TemplateChildAtom>
  | TemplateChildAtom[]
  | DynamicList;

export type Template = {
  stringParts: TemplateStringsArray;
  values: TemplateValuePart[];
};

export function childIsDynamicList(tc: TemplateChild): tc is DynamicList {
  return typeof tc === "object" && DYNAMIC_LIST in tc;
}

export function html(
  stringParts: TemplateStringsArray,
  ...valParts: TemplateChild[]
): Template {
  const template: Template = {
    stringParts,
    values: [],
  };

  for (let idx = 0; idx < valParts.length; idx += 1) {
    const value = valParts[idx];
    const stringBefore = stringParts[idx];

    const attributeMatch = attributeMatcher.exec(stringBefore);
    if (attributeMatch)
      template.values.push({ attribute: attributeMatch[1], value });
    else template.values.push({ child: value });
  }

  return template;
}
