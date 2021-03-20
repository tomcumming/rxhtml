import { from, into, of } from "cancelstream";
import { renderTemplate } from "./dom";
import { html } from "./html";

async function* seconds() {
  let count = 0;
  while (true) {
    await new Promise((res) => setTimeout(res, 1000));
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
`;

async function main() {
  for await (const node of into(renderTemplate(myExampleTemplate))) {
    document.body.appendChild(node);
  }
}

main();
