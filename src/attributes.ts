import { from, isObservable, Observable, of } from "rxjs";
import { map, mergeAll } from "rxjs/operators";

import { AttributeChange, REMOVE_ATTRIBUTE } from "./html";

export function fixed(kvs: {
  [name: string]: string | Observable<string | typeof REMOVE_ATTRIBUTE>;
}): Observable<AttributeChange> {
  const streams: Observable<AttributeChange>[] = Object.entries(
    kvs
  ).flatMap(([name, values]) =>
    isObservable(values)
      ? values.pipe(map((value) => ({ name, value })))
      : of({ name, value: values })
  );
  return from(streams).pipe(mergeAll());
}
