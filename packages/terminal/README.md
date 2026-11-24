# @dxjs/terminal

A resilient, CSP-safe line-oriented web terminal. Output rides a
`@dxjs/transport` LiveSource, so it inherits the SSE layer's reconnect / backoff /
resume — when the connection drops and a resume-aware server replays missed
events, the terminal catches up without losing or duplicating output.

```ts
import { createLiveSource } from "@dxjs/transport";
import { createTerminal } from "@dxjs/terminal";

const source = createLiveSource("/pty/events");          // resilient SSE
const term = createTerminal({
  source, topic: "output",
  onInput: (data) => fetch("/pty/stdin", { method: "POST", body: data }),
});
render(term.view(), host);     // <pre> output (escaped) + command input
```

Rendering is a `<pre>` through the safe `textContent` sink (output is escaped — no
XSS) and input is a plain `<input>` with an `@keydown` listener: no eval, no
innerHTML, no inline handler → strict-CSP safe.

Scope: a line-oriented terminal (scrollback + command line). Full VT/ANSI cursor
emulation, colors and xterm.js integration are out of scope.
