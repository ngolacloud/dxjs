// Tarefas — the frontend: dxjs + @dxjs/ui, fed live by the backend.
import { signal, computed } from "@dxjs/core";
import { html, render } from "@dxjs/dom";
import { composeTransport, createRpcClient, liveSignal, restAdapter, sseAdapter } from "@dxjs/transport";
import { button, card, checkbox, emptyState, input, pill, statGrid } from "@dxjs/ui";
import { createTask, toggleTask, watchTasks, type Task } from "./api.ts";

// Same origin as the server, so no base URL. Unary calls over REST, the live list
// over SSE — one transport, one client.
const transport = composeTransport(
  restAdapter(),
  sseAdapter({ reconnect: true }),
);
const api = createRpcClient(transport);

// Every change made by anyone arrives here: no refetch, no manual refresh.
const tasks = liveSignal(transport, watchTasks, {}, { initial: [] as Task[] });
const all = computed(() => tasks() ?? []);
const open = computed(() => all().filter((t) => !t.done).length);

const draft = signal("");
const saving = signal(false);
const failure = signal("");

async function add(): Promise<void> {
  const title = draft().trim();
  if (!title) return;
  saving.set(true);
  failure.set("");
  try {
    await api.call(createTask, { title });
    draft.set("");
  } catch (err) {
    failure.set(`Não foi possível criar a tarefa: ${String(err)}`);
  } finally {
    saving.set(false);
  }
}

const row = (t: Task) => html`<li class="task">
  ${checkbox({ checked: () => t.done, onChange: () => void api.call(toggleTask, { id: t.id }), label: t.title })}
  ${pill(t.done ? "feita" : "por fazer", t.done ? "pos" : "mut")}
</li>`;

render(
  html`<main class="app">
    ${statGrid([
      { label: "Tarefas", value: () => String(all().length) },
      { label: "Por fazer", value: () => String(open()), tone: "neg" },
      { label: "Feitas", value: () => String(all().length - open()), tone: "pos" },
    ])}
    ${card({
      title: "Nova tarefa",
      body: html`<form class="new" @submit=${(e: Event) => { e.preventDefault(); void add(); }}>
        ${input({ value: draft, onInput: (v) => draft.set(v), placeholder: "O que há para fazer?" })}
        ${button({ label: "Adicionar", variant: "primary", loading: saving, onClick: () => void add() })}
      </form>
      <p class="err">${failure}</p>`,
    })}
    ${card({
      title: "Tarefas",
      body: () =>
        all().length
          ? html`<ul class="tasks">${all().map(row)}</ul>`
          : emptyState({ title: "Sem tarefas", description: "Escreve a primeira acima." }),
    })}
  </main>`,
  document.getElementById("app")!,
);
