import {
  CancelSignal,
  Stream,
  subscribe,
  COMPLETED,
  apply,
  exhaustStreamBody,
  StreamBody,
} from "cancelstream";
import map from "cancelstream/ops/map";
import switchTo from "cancelstream/ops/switchTo";
import * as Html from "./html";

async function renderNode(
  template: Html.Template,
  cs: CancelSignal
): Promise<[Node, StreamBody<unknown>]> {
  const iter = renderTemplate(template)(cs);
  const firstResult = await iter.next();
  if (firstResult.done)
    throw new Error(`Render template should return a single Node`);
  return [firstResult.value, iter];
}

function renderElement(element: Html.Element): Stream<Node> {
  return async function* (cs: CancelSignal) {
    const node = document.createElement(element.tagName);

    let childNodeIter: undefined | StreamBody<unknown>;
    if (element.body) {
      const [childNode, iter] = await renderNode(element.body, cs);
      childNodeIter = iter;
      node.appendChild(childNode);
    }

    yield node;

    const attributesTask = subscribe(element.attributes, cs, async (change) => {
      if (change.value === Html.REMOVE_ATTRIBUTE)
        node.removeAttribute(change.name);
      else node.setAttribute(change.name, change.value);
    });
    const bodyTask = childNodeIter
      ? exhaustStreamBody(childNodeIter)
      : Promise.resolve(COMPLETED);

    await Promise.all([attributesTask, bodyTask]);

    await cs[0];
    if (childNodeIter) await exhaustStreamBody(childNodeIter);
    node.remove();

    return COMPLETED;
  };
}

function renderText(value: string | Stream<string>): Stream<Node> {
  return async function* (cs: CancelSignal) {
    const node = document.createTextNode(
      typeof value === "string" ? value : ""
    );
    yield node;

    if (typeof value !== "string") {
      await subscribe(value, cs, async (data) => (node.data = data));
    }

    await cs[0];
    node.remove();
    return COMPLETED;
  };
}

function renderTemplateStream(template$: Stream<Html.Template>): Stream<Node> {
  return async function* (cs: CancelSignal) {
    const marker = document.createComment(`HTMLSTREAM stream end`);
    const docFrag = document.createDocumentFragment();
    docFrag.appendChild(marker);
    yield docFrag;

    const templateNode$ = apply(template$, map(renderTemplate), switchTo());

    await subscribe(templateNode$, cs, async (node) => {
      marker.parentNode?.insertBefore(node, marker);
    });

    await cs[0];
    marker.remove();

    return COMPLETED;
  };
}

function renderTemplateList(templates: Html.TemplateAtom[]): Stream<Node> {
  return async function* (cs: CancelSignal) {
    const docFrag = document.createDocumentFragment();

    const renderedNodes = await Promise.all(
      templates.map((template) => renderNode([template], cs))
    );
    for (const [node] of renderedNodes) docFrag.appendChild(node);

    const marker = document.createComment(`HTMLSTREAM list end`);
    docFrag.appendChild(marker);
    yield docFrag;

    await Promise.all(
      renderedNodes.map(([_node, iter]) => exhaustStreamBody(iter))
    );
    await cs[0];
    marker.remove();

    return COMPLETED;
  };
}

function renderTemplateAtom(template: Html.TemplateAtom): Stream<Node> {
  if ("text" in template) return renderText(template.text);
  else if ("element" in template) return renderElement(template.element);
  else if ("stream" in template) return renderTemplateStream(template.stream);
  else throw new Error(`Unknown template atom type`);
}

// always returns one Node, cancel to unsub and remove
export function renderTemplate(template: Html.Template): Stream<Node> {
  if (template.length === 1) {
    return renderTemplateAtom(template[0]);
  } else {
    return renderTemplateList(template);
  }
}
