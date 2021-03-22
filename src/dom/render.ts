import {
  apply,
  COMPLETED,
  exhaustStreamBody,
  of,
  Stream,
  StreamBody,
  subscribe,
  CancelSignal,
} from "cancelstream";
import switchTo from "cancelstream/ops/switchTo";
import map from "cancelstream/ops/map";
import * as Html from "../html";
import { renderDynamicList } from "./dynamic-list";
import { renderTemplate } from ".";

export async function renderNode(
  node$: Stream<Node>,
  cs: CancelSignal
): Promise<[Node, StreamBody<unknown>]> {
  const iter = node$(cs);
  const result = await iter.next();
  if (result.done) throw new Error(`Should have rendered a single node`);
  return [result.value, iter];
}

function renderChildStream(
  template$: Stream<Html.TemplateChildAtom>
): Stream<Node> {
  return async function* (cs: CancelSignal) {
    const fragment = document.createDocumentFragment();
    const startMarker = document.createComment("HTMLSTREAM stream start");
    const endMarker = document.createComment("HTMLSTREAM stream end");

    fragment.appendChild(startMarker);
    fragment.appendChild(endMarker);

    yield fragment;

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

    return COMPLETED;
  };
}

function renderStaticList(templates: Html.TemplateChildAtom[]): Stream<Node> {
  return async function* (cs: CancelSignal) {
    const children = await Promise.all(
      templates.map((template) => renderNode(renderTemplateChild(template), cs))
    );

    const fragment = document.createDocumentFragment();

    for (const [childNode] of children) fragment.appendChild(childNode);

    yield fragment;

    await Promise.all(children.map(([_node, iter]) => exhaustStreamBody(iter)));
    return COMPLETED;
  };
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
