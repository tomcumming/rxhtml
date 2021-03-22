import {
  CancelSignal,
  COMPLETED,
  exhaustStreamBody,
  Stream,
  StreamBody,
  subscribe,
} from "cancelstream";
import { cancelSignal, CancelTrigger } from "cancelstream/cancel";

import * as Html from "../html";
import { renderNode, renderTemplateChild } from "./render";

async function dynamicListAdd(
  cs: CancelSignal,
  endMarker: Comment,
  children: [Comment, CancelTrigger, StreamBody<unknown>][],
  index: number,
  template: Html.TemplateChildAtom
): Promise<void> {
  if (index < 0 || index > children.length) throw new Error(`List add OOB`);

  const childCs = cancelSignal(cs);

  const [newNode, newStreamBody] = await renderNode(
    renderTemplateChild(template),
    childCs.cs
  );

  const childStartComment = document.createComment("STREAMHTML li start");
  const childFrag = document.createDocumentFragment();
  childFrag.appendChild(childStartComment);
  childFrag.appendChild(newNode);

  const nextMarker = children[index]?.[0] || endMarker;
  nextMarker.parentNode?.insertBefore(childFrag, nextMarker);
  children.splice(index, 0, [childStartComment, childCs.cancel, newStreamBody]);
}

async function dynamicListRemove(
  endMarker: Comment,
  children: [Comment, CancelTrigger, StreamBody<unknown>][],
  index: number
): Promise<void> {
  if (index < 0 || index >= children.length) throw new Error(`List remove OOB`);

  const [startMarker, cancel, streamBody] = children[index];
  cancel();
  await exhaustStreamBody(streamBody);

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
  return async function* (cs: CancelSignal) {
    const endMarker = document.createComment("STREAMHTML end list");
    const fragment = document.createDocumentFragment();
    fragment.appendChild(endMarker);
    yield fragment;

    const children: [Comment, CancelTrigger, StreamBody<unknown>][] = [];

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

    for (const [comment] of children) comment.remove();
    endMarker.remove();

    await Promise.all(
      children.map(([_comment, _cancel, body]) => exhaustStreamBody(body))
    );

    return COMPLETED;
  };
}
