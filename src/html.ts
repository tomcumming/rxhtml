import { Stream } from "cancelstream";

export const REMOVE_ATTRIBUTE = Symbol("Delete Attribute");

export type AttributeChange = {
  name: string;
  value: string | typeof REMOVE_ATTRIBUTE;
};

export type Attributes = Stream<AttributeChange>;

export type Element = {
  tagName: string;
  attributes: Attributes;
  body?: Template;
};

export type TemplateAtom =
  | { text: string | Stream<string> }
  | { element: Element }
  | { stream: Stream<Template> };

export type Template = TemplateAtom[];
