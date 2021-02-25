import { combineLatest, from, isObservable, Observable, of } from "rxjs";
import { map } from "rxjs/operators";
import { Template } from "./html";

export type Printable = string | number | boolean;

export default function text(
  stringParts: TemplateStringsArray,
  ...values: (Printable | Observable<Printable>)[]
): Template {
  // Because combineLatests will never emit with 0 length array
  if (values.length === 0) return { text: of(stringParts.join("")) };

  const latest$ = combineLatest(
    values.map((value) => (isObservable(value) ? value : of(value)))
  );
  return {
    text: latest$.pipe(
      map((latest) => {
        console.log("latest", latest);
        return [
          stringParts[0],
          ...latest.flatMap((v, idx) => [v, stringParts[idx + 1]]),
        ].join("");
      })
    ),
  };
}
