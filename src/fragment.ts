import { EMPTY, from } from "rxjs";
import { Observable } from "rxjs";
import { concatAll, map, scan } from "rxjs/operators";
import { Fragment, FragmentChange, Template } from "./html";

export function fixed(children: Template[]): Fragment {
  console.log("fixed");
  const changes = children.map<FragmentChange>((template, index) => ({
    insert: { index, template },
  }));
  return from(changes);
}

export function single(temps: Observable<Template>): Fragment {
  console.log("single");
  const scanOperation = scan<Template, FragmentChange[]>(
    (prev, template) =>
      prev.length === 0
        ? [{ insert: { index: 0, template } }]
        : [{ remove: 0 }, { insert: { index: 0, template } }],
    []
  );
  return temps.pipe(
    scanOperation,
    concatAll() // Might be a problem with missing templates?
  );
}
