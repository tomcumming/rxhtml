import { COMPLETED, Stream, subscribe, CancelSignal } from "cancelstream";
import * as Html from "../html";
import { renderTemplateChild } from "./render";

const identifiablePrefix = `__STREAM__HTML__MARKER__`;

function htmlForTemplate(template: Html.Template): string {
  return (
    template.stringParts[0] +
    template.values
      .map((value, idx) => {
        const markerBit =
          "attribute" in value
            ? `"${identifiablePrefix}${idx}"`
            : `<slot data-marker="${identifiablePrefix}${idx}"></slot>`;
        return markerBit + template.stringParts[idx + 1];
      })
      .join("")
  );
}

function findChildValueNodes(fragment: DocumentFragment): Element[] {
  let nodes: Element[] = [];
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_ELEMENT);
  let currentNode = walker.nextNode();
  while (currentNode instanceof Element) {
    if (currentNode.tagName === "slot") {
      const markerAttr = currentNode.getAttribute("data-marker");
      if (markerAttr?.startsWith(identifiablePrefix)) {
        currentNode.removeAttribute("data-marker");
        nodes.push(currentNode);
        currentNode = walker.nextNode();
        continue;
      }
    }

    for (const attr of currentNode.attributes)
      if (attr.value.startsWith(identifiablePrefix)) nodes.push(currentNode);

    currentNode = walker.nextNode();
  }
  return nodes;
}

function setupAttribute(
  cs: CancelSignal,
  parentElement: Element,
  name: string,
  value: unknown
): Promise<unknown> {
  function changeValue(value: unknown) {
    if (
      typeof value === "boolean" ||
      typeof value === "string" ||
      typeof value === "number"
    ) {
      if (value === false) parentElement.removeAttribute(name);
      else
        parentElement.setAttribute(
          name,
          value === true ? "" : value.toString()
        );
    } else {
      throw new Error(`Unexpected attribute value for '${name}'`);
    }
  }

  if (typeof value === "function") {
    const valueAsStream = value as Stream<undefined>;
    return subscribe(valueAsStream, cs, async (value) => {
      changeValue(value);
    });
  } else {
    changeValue(value);
    return Promise.resolve();
  }
}

export function renderTemplate(
  template: Html.Template
): Stream<DocumentFragment> {
  return async function* (cs: CancelSignal) {
    const templateElement = document.createElement("template");
    templateElement.innerHTML = htmlForTemplate(template);

    const fragmentInstance = templateElement.content;

    const valueNodes = findChildValueNodes(fragmentInstance);
    if (valueNodes.length !== template.values.length)
      throw new Error(`Template values length does not match`);

    const childTasks = template.values.map((templateValue, idx) => {
      if ("attribute" in templateValue) {
        return setupAttribute(
          cs,
          valueNodes[idx],
          templateValue.attribute,
          templateValue.value
        );
      } else {
        return subscribe(
          renderTemplateChild(templateValue.child),
          cs,
          async (childFragment) => {
            valueNodes[idx].replaceWith(childFragment);
          }
        );
      }
    });

    yield fragmentInstance;

    await Promise.all(childTasks);
    return COMPLETED;
  };
}
