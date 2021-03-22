import {
  apply,
  CancelSignal,
  COMPLETED,
  exhaustStreamBody,
  of,
  Stream,
  StreamBody,
  subscribe,
} from "cancelstream";
import switchTo from "cancelstream/ops/switchTo";
import map from "cancelstream/ops/map";
import * as Html from "./html";

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

async function renderNode(
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

async function dynamicListRemove(
  endMarker: Comment,
  children: [Comment, StreamBody<unknown>][],
  index: number
): Promise<void> {
  if (index < 0 || index >= children.length) throw new Error(`List remove OOB`);

  const [startMarker, streamBody] = children[index];
  await exhaustStreamBody(streamBody);

  const end = children[index + 1]?.[0] || endMarker;
  for (
    let current: null | ChildNode = startMarker;
    current !== end;
    current = current?.nextSibling || null
  ) {
    current?.remove();
  }

  children.splice(index, 1);
}

async function dynamicListAdd(
  cs: CancelSignal,
  endMarker: Comment,
  children: [Comment, StreamBody<unknown>][],
  index: number,
  template: Html.TemplateChildAtom
): Promise<void> {
  if (index < 0 || index > children.length) throw new Error(`List add OOB`);

  const [newNode, newStreamBody] = await renderNode(
    renderTemplateChild(template),
    cs
  );

  const childStartComment = document.createComment("STREAMHTML li start");
  const childFrag = document.createDocumentFragment();
  childFrag.appendChild(childStartComment);
  childFrag.appendChild(newNode);

  const nextMarker = children[index]?.[0] || endMarker;
  nextMarker.parentNode?.insertBefore(childFrag, nextMarker);
  children.splice(index, 0, [childStartComment, newStreamBody]);
}

function renderDynamicList(
  change$: Stream<Html.DynamicListChange>
): Stream<Node> {
  return async function* (cs: CancelSignal) {
    const endMarker = document.createComment("STREAMHTML end list");
    const fragment = document.createDocumentFragment();
    fragment.appendChild(endMarker);
    yield fragment;

    const children: [Comment, StreamBody<unknown>][] = [];

    await subscribe(change$, cs, async (change) => {
      if ("remove" in change) {
        await dynamicListRemove(endMarker, children, change.remove);
      } else {
        await dynamicListAdd(
          cs,
          endMarker,
          children,
          change.insert,
          change.value
        );
      }
    });

    return COMPLETED;
  };
}

function renderTemplateChild(template: Html.TemplateChild): Stream<Node> {
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
