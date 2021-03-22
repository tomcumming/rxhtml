import { from, into, of } from "cancelstream";
import { renderTemplate } from "./dom";
import * as Html from "./html";
import { html } from "./html";

function delay(timeMs: number) {
  return new Promise((res) => setTimeout(res, timeMs));
}

async function* dynamicListChanges(): AsyncGenerator<Html.DynamicListChange> {
  yield { insert: 0, template: "One" }, await delay(1000);
  yield { insert: 1, template: html`<h2>Two</h2>` };
  await delay(1000);
  yield { remove: 0 };
  yield { insert: 1, template: html`<h3>Three</h3>` };
  await delay(2000);
  yield { remove: 1 };
}

const dynamicListTest: Html.DynamicList = {
  [Html.DYNAMIC_LIST]: from(dynamicListChanges()),
};

async function* seconds() {
  let count = 0;
  while (true) {
    await delay(1000);
    yield count++;
  }
}

const myExampleTemplate = html`
  Hello
  <h1 title=${of("First value", "second value")}>
    Counting seconds: ${from(seconds())}
  </h1>
  <ul>
    ${[1, 2, 3].map((n) => html`<li>Item ${n}</li>`)}
  </ul>
  ${dynamicListTest}
`;

async function main() {
  for await (const node of into(renderTemplate(myExampleTemplate))) {
    document.body.appendChild(node);
  }
}

main();
