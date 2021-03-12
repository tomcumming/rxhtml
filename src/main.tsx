import {
  CancelSignal,
  Stream,
  subscribe,
  COMPLETED,
  apply,
} from "cancelstream";
import map from "cancelstream/ops/map";
import { cancelSignal } from "cancelstream/cancel";

import * as Jsx from "./jsx";
import { renderTemplate } from "./dom";

// Example :D
const second$: Stream<Date> = async function* (cs: CancelSignal) {
  let going = true;
  cs[0].then(() => {
    going = false;
  });

  while (going) {
    await new Promise((res) => setTimeout(res, 1000));
    yield new Date();
  }
  return COMPLETED;
};

const timeMsg$ = apply(
  second$,
  map((d) => d.toLocaleTimeString())
);

const myTemplate = (
  <>
    <h1>Welcome to my example</h1>
    <p title={timeMsg$}>The time: {timeMsg$}</p>
  </>
);

const myCancelSignal = cancelSignal();
(window as any).stopIt = myCancelSignal.cancel;

subscribe(renderTemplate(myTemplate), myCancelSignal.cs, async (node) => {
  document.body.appendChild(node);
});
