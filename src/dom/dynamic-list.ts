import {
  CancelSignal,
  COMPLETED,
  finish,
  fromGenerator,
  Stream,
  StreamResult,
  subscribe,
} from "cancelstream";
import { cancelSignal, CancelTrigger } from "cancelstream/cancel";

import * as Html from "../html";
import { ensureNode, renderTemplateChild } from "./render";

const CHILD_SHOULD_HAVE_COMPLETED = `Child should have completed`;

async function dynamicListAdd(
  cs: CancelSignal,
  endMarker: Comment,
  children: [Comment, CancelTrigger, Promise<StreamResult<unknown>>][],
  index: number,
  template: Html.TemplateChildAtom
): Promise<void> {
  if (index < 0 || index > children.length) throw new Error(`List add OOB`);

  const [childCs, childTrigger] = cancelSignal();

  const [newNode$, newNode] = await ensureNode(renderTemplateChild(template));
  const newStreamResult = newNode$(childCs);

  const childStartComment = document.createComment("STREAMHTML li start");
  const childFrag = document.createDocumentFragment();
  childFrag.appendChild(childStartComment);
  childFrag.appendChild(newNode);

  const nextMarker = children[index]?.[0] || endMarker;
  nextMarker.parentNode?.insertBefore(childFrag, nextMarker);
  children.splice(index, 0, [childStartComment, childTrigger, newStreamResult]);
}

async function dynamicListRemove(
  endMarker: Comment,
  children: [Comment, CancelTrigger, Promise<StreamResult<unknown>>][],
  index: number
): Promise<void> {
  if (index < 0 || index >= children.length) throw new Error(`List remove OOB`);

  const [startMarker, cancel, streamResult] = children[index];
  cancel();
  if ((await streamResult) !== COMPLETED)
    throw new Error(CHILD_SHOULD_HAVE_COMPLETED);

  const end = children[index + 1]?.[0] || endMarker;
  let current: null | ChildNode = startMarker;
  while (current !== end) {
    if (current === null) throw new Error(`Could not find end marker`);
    const removing = current;
    current = current.nextSibling;
    removing.remove();
  }

  children.splice(index, 1);
}

export function renderDynamicList(
  change$: Stream<Html.DynamicListChange>
): Stream<Node> {
  return fromGenerator(async function* (cs: CancelSignal) {
    const endMarker = document.createComment("STREAMHTML end list");
    const fragment = document.createDocumentFragment();
    fragment.appendChild(endMarker);
    [cs] = yield fragment;

    const children: [
      Comment,
      CancelTrigger,
      Promise<StreamResult<unknown>>
    ][] = [];

    await subscribe(change$, cs, async (change) => {
      if ("remove" in change) {
        await dynamicListRemove(endMarker, children, change.remove);
      } else {
        await dynamicListAdd(
          cs,
          endMarker,
          children,
          change.insert,
          change.template
        );
      }
    });

    await cs;

    while (children.length > 0) await dynamicListRemove(endMarker, children, 0);
    endMarker.remove();

    return COMPLETED;
  });
}
