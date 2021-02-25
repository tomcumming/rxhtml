import { Observable } from "rxjs";

export const REMOVE_ATTRIBUTE = Symbol("Delete Attribute");

export type AttributeChange = {
  name: string;
  value: string | typeof REMOVE_ATTRIBUTE;
};

export type Attributes = Observable<AttributeChange>;

export type FragmentChange =
  | { insert: { index: number; template: Template } }
  | { remove: number };

export type Fragment = Observable<FragmentChange>;

export type Element = {
  tagName: string;
  attributes: Attributes;
  body?: Template;
};

export type Text = Observable<string>;

export type Template =
  | { text: Text }
  | { element: Element }
  | { fragment: Fragment };
