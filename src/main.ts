import { EMPTY, interval, Subscription } from "rxjs";
import { map, startWith } from "rxjs/operators";
import * as Atts from "./attributes";
import * as Html from "./html";
import * as Fragment from "./fragment";
import text from "./text";

type FragmentChild = {
  firstNode: Node;
  sub: Subscription;
};

function renderFragment(
  template: Html.Fragment
): { fc: FragmentChild; frag: DocumentFragment } {
  const frag = document.createDocumentFragment();

  const endMarkerComment = document.createComment("RxHtml Fragment End");
  frag.appendChild(endMarkerComment);

  const fc: FragmentChild = {
    firstNode: endMarkerComment,
    sub: new Subscription(),
  };

  let children: FragmentChild[] = [];

  fc.sub.add(() => {
    console.log("removing fragment");

    for (const child of children) child.sub.unsubscribe();

    endMarkerComment.remove();
  });

  const changesSub = template.subscribe((change) => {
    if ("remove" in change) {
      console.log("Removing child", change.remove);
      // TODO bounds check
      const [removed] = children.splice(change.remove, 1);
      removed.sub.unsubscribe();
    } else if ("insert" in change) {
      console.log("inserting child at", change.insert.index);
      // TODO bounds check
      const nodeAfter =
        change.insert.index === children.length
          ? endMarkerComment
          : children[change.insert.index].firstNode;
      const { fc, node } = renderTemplate(change.insert.template);
      endMarkerComment.parentNode?.insertBefore(node, nodeAfter);
      children.splice(change.insert.index, 0, fc);
    }
  });
  fc.sub.add(changesSub);

  return { fc, frag };
}

function renderElement(
  template: Html.Element
): {
  fc: FragmentChild;
  elem: HTMLElement;
} {
  const elem = document.createElement(template.tagName);

  const sub = new Subscription();

  sub.add(
    template.attributes.subscribe((change) => {
      if (change.value === Html.REMOVE_ATTRIBUTE)
        elem.removeAttribute(change.name);
      else elem.setAttribute(change.name, change.value);
    })
  );

  if (template.body) {
    const { fc, node } = renderTemplate(template.body);
    sub.add(fc.sub);
    elem.appendChild(node);
  }

  sub.add(() => {
    console.log("removing element");
    elem.remove();
  });

  return { fc: { sub, firstNode: elem }, elem };
}

function renderText(value$: Html.Text): { fc: FragmentChild; text: Text } {
  const text = document.createTextNode("");

  const sub = value$.subscribe((value) => {
    text.data = value;
  });

  return { fc: { firstNode: text, sub }, text };
}

function renderTemplate(
  template: Html.Template
): { fc: FragmentChild; node: Node } {
  if ("fragment" in template) {
    const { fc, frag } = renderFragment(template.fragment);
    return { fc, node: frag };
  } else if ("element" in template) {
    const { fc, elem } = renderElement(template.element);
    return { fc, node: elem };
  } else if ("text" in template) {
    const { fc, text } = renderText(template.text);
    return { fc, node: text };
  } else {
    throw new Error(`Unknown template type`);
  }
}

const time$ = interval(1000).pipe(
  startWith(-1),
  map(() => new Date().toLocaleTimeString())
);

const elem: Html.Element = {
  tagName: "p",
  attributes: Atts.fixed({
    "data-hello": "World",
    "data-timer": interval(1000).pipe(map((n) => n.toString())),
  }),
  body: Fragment.fixed(text`Hello World `, {
    element: {
      tagName: "strong",
      attributes: EMPTY,
      body: text`The time is ${time$}`,
    },
  }),
};

// Example :D

const rendered = renderTemplate({ element: elem });
document.body.appendChild(rendered.node);
(window as any).fc = rendered.fc;
