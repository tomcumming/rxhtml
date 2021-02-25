# Fun frontend with observables

## Ideas

- Heavy inspiration from [React](https://reactjs.org/), [lit-html](https://lit-html.polymer-project.org/), [cyclejs](https://cycle.js.org/)
- JSX
- No VDOM, opt in diffing where it makes sense
- You control re-renders, send a new template to recreate an element/node
- Easy render to `string` and hydration
- One way to do it, use observables for everything, even component lifecycle
