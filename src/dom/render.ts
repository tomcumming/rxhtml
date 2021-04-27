import {
  apply,
  COMPLETED,
  of,
  Stream,
  subscribe,
  CancelSignal,
  fromGenerator,
  intoArray,
} from "cancelstream";
import map from "cancelstream/ops/map";
import switchTo from "cancelstream/ops/switchTo";
import * as Html from "../html";
import { renderTemplate } from ".";
import { NEVER } from "cancelstream/cancel";
import { renderDynamicList } from "./dynamic-list";

export async function ensureNode(
  node$: Stream<Node>
): Promise<[Stream<unknown>, Node]> {
  const result = await node$(NEVER);
  if (result === COMPLETED)
    throw new Error(`Should have rendered a single node`);
  return result;
}

function renderChildStream(
  template$: Stream<Html.TemplateChildAtom>
): Stream<Node> {
  return fromGenerator(async function* (cs: CancelSignal) {
    const fragment = document.createDocumentFragment();
    const startMarker = document.createComment("HTMLSTREAM stream start");
    const endMarker = document.createComment("HTMLSTREAM stream end");

    fragment.appendChild(startMarker);
    fragment.appendChild(endMarker);

    [cs] = yield fragment;

    await subscribe(
      apply(template$, map(renderTemplateChild), switchTo()),
      cs,
      async (childNode) => {
        let currentNode = startMarker.nextSibling;
        while (currentNode !== endMarker) {
          if (currentNode === null)
            throw new Error(`Can't find stream end marker`);
          const nextNode = currentNode.nextSibling;
          currentNode.remove();
          currentNode = nextNode;
        }
        endMarker.parentNode?.insertBefore(childNode, endMarker);
      }
    );

    startMarker.remove();
    endMarker.remove();

    return COMPLETED;
  });
}

function renderStaticList(templates: Html.TemplateChildAtom[]): Stream<Node> {
  return fromGenerator(async function* (cs: CancelSignal) {
    const children = await Promise.all(
      templates.map((template) => ensureNode(renderTemplateChild(template)))
    );

    const fragment = document.createDocumentFragment();

    for (const [_node$, childNode] of children) fragment.appendChild(childNode);

    [cs] = yield fragment;

    await Promise.all(children.map(([node$]) => intoArray(node$, cs)));
    return COMPLETED;
  });
}

export function renderTemplateChild(
  template: Html.TemplateChild
): Stream<Node> {
  if (Array.isArray(template)) {
    return renderStaticList(template);
  } else if (typeof template === "function") {
    return renderChildStream(template);
  } else if (Html.childIsDynamicList(template)) {
    return renderDynamicList(template[Html.DYNAMIC_LIST]);
  } else if (typeof template === "object") {
    return renderTemplate(template);
  } else {
    return of(document.createTextNode(template.toString()));
  }
}
