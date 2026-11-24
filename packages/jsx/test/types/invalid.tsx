// Negative type fixture: each line below MUST be rejected by the type-checker.
// The `@ts-expect-error` directives turn that into an assertion — if ANY of these
// stopped being an error (a prop silently accepted), tsc reports an unused
// directive and `npm run gate:jsx-types` fails. This is how we prove the typing
// actually catches mistakes.
import type { JSX } from "@dxjs/jsx";

function Badge(props: { label: string }): JSX.Element {
  return <span>{props.label}</span>;
}

export const bad: JSX.Element[] = [
  // Unknown attribute on a typed element.
  // @ts-expect-error — `typ` is not a valid <input> attribute (typo for `type`).
  <input typ="text" />,

  // Wrong value type for a boolean attribute.
  // @ts-expect-error — `disabled` expects a boolean, not a string.
  <input disabled="yes" />,

  // Event handler must be a function.
  // @ts-expect-error — `onClick` expects a handler, not a string.
  <button onClick="go">x</button>,

  // Missing required component prop.
  // @ts-expect-error — <Badge> requires `label`.
  <Badge />,

  // Wrong component prop.
  // @ts-expect-error — `count` is not a prop of <Badge>.
  <Badge label="a" count={1} />,
];
