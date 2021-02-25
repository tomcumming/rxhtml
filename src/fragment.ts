import { from, Observable } from "rxjs";
import { Fragment, FragmentChange, Template } from "./html";

export function fixed(...children: Template[]): Template {
  const changes: FragmentChange[] = children.map((template, index) => ({
    insert: { index, template },
  }));
  return {
    fragment: from(changes),
  };
}
