# dxjs vs. React — relatório de paridade

> **Pergunta:** o dxjs já entrega o que o React entrega hoje, ao ponto de o
> **delonix-console** poder ser reescrito em dxjs? Ou ainda estamos distantes?
>
> **Resposta curta:** para *este* console, **é viável** — o núcleo (reactividade,
> DOM, componentes, router, SSR, transporte, grafo de nós, gráficos) está coberto
> por dxjs com tamanho e segurança (CSP estrita) muito superiores. **Não é um
> *drop-in* hoje:** faltam ~5 peças bem delimitadas (contexto/DI, *error
> boundaries*, uma camada de *cache* de dados, virtualização de listas e um
> *helper* de formulários). Nenhuma é um obstáculo de fundo; são adições focadas.

Este documento mede o dxjs **contra o que o delonix-console realmente usa** (não
contra o React em abstracto). Stack actual do console (React): `react`/`react-dom`,
`@tanstack/react-query`, `@tanstack/react-router`, `@tanstack/react-virtual`,
`@xyflow/react`, `react-hook-form` + `zod` + `@hookform/resolvers`, `zustand`,
`i18next`/`react-i18next`, `@xterm/xterm`, `dexie`. Escala: 1043 ficheiros, 372
`.tsx`.

---

## 1. O que o dxjs já entrega (mapa 1:1)

| Necessidade (React/console) | Equivalente dxjs | Estado |
|---|---|---|
| Estado local/global (`useState`, **zustand**) | `signal`/`computed` (`@dxjs/core`) | ✅ Cobre. Signals *fine-grained* substituem `useState` **e** o store global do zustand (um signal em módulo é um store partilhado). |
| Efeitos/derivados (`useEffect`, `useMemo`) | `effect`, `computed`, `batch`, `untrack`, `onCleanup`, `createRoot` | ✅ Cobre, sem *stale closures* nem *dependency arrays*. *Glitch-free*, *diamond-safe* (testado). |
| JSX / render | `html\`\`` + sinks escapados (`@dxjs/dom`) | ✅ Cobre. *Escape* por omissão; sem VDOM → *patch* cirúrgico. **Sem `eval`, sem handlers inline** (o JSX/React precisa de *build*; o `html` corre directo). |
| Componentes + ciclo de vida | `component`, `mount`, `onMount`, `onCleanup` (`@dxjs/component`) | ✅ Cobre o essencial. Componentes correm **uma vez** (estilo Solid) — sem re-render, sem `useCallback`/`memo`. |
| Routing (**@tanstack/react-router**) | `createRouter` (`@dxjs/component`) | ✅ Cobre o básico: History API, params `:id`, *wildcard*, `load: () => import()` (*code-split*), *guards* (UX-only), `fallback`, `outlet` com *teardown*. ⚠️ **Sem** rotas aninhadas/*layouts* nem *loaders* tipados como o TanStack. |
| Fetch de dados (`fetch` + **react-query** parcial) | `resource` (`@dxjs/transport`) | ⚠️ Parcial — ver §2. Tem `loading`/`error`/`refetch`, `AbortController`, *generation guard*, re-fetch reactivo, *abort* no *unmount*. **Falta** o *cache* partilhado/dedupe/invalidação. |
| Tempo real | `createLiveSource` (SSE multiplexado por tópico) | ✅ **Supera** — uma ligação partilhada, *push* de deltas → signal → *patch*. Sem equivalente directo no stack React actual. |
| gRPC | `createConnectClient` + gRPC nativo no edge (`@dxjs/edge`) | ✅ Cobre (o console hoje é REST/SSE; opcional). |
| SSR / hidratação | `renderToString` + `hydrate` (`@dxjs/server`) | ✅ Cobre SSR *DOM-free* + hidratação *fine-grained*. |
| Edge compute | `createEdgeHandler`, `nodeListener` (`@dxjs/edge`) | ✅ Cobre (Web-standard fetch/streams). |
| Grafo de nós (**@xyflow/react**) | `@dxjs/canvas` (modelo + geometria + render 2D + drag/connect/pan/zoom) | ✅ Cobre o caso do console (pipelines/diagramas de arquitectura). |
| Kit de componentes | `@dxjs/ui` (appShell, statGrid, card, pill, dataTable) | ✅ Base sólida; ampliável. |
| Gráficos | `@dxjs/charts` (Chart.js, CSP-clean) | ✅ Novo nesta campanha. |
| Terminal (**@xterm/xterm**) | — (lib agnóstica) | ✅ Usável **tal-qual**; não depende de React. |
| i18n (**i18next**) | — (lib agnóstica) | ✅ `i18next` *core* é agnóstico; liga-se a um signal de *locale*. (Não há `@dxjs/i18n`, mas não é preciso.) |
| Validação (**zod**) | — (lib agnóstica) | ✅ `zod` funciona **tal-qual** (ver forms em §2). |
| IndexedDB (**dexie**) | — (lib agnóstica) | ✅ Usável *tal-qual*. |

**Leitura:** tudo o que é *específico de React* no console (react-query, react-router,
react-virtual, xyflow) tem equivalente dxjs **ou** a lib já é agnóstica (zod, xterm,
i18next, dexie). Os *diferenciadores* do dxjs (tamanho ~2.8 KB vs ~45 KB, CSP
estrita sem `eval`/inline, SSE por-componente) são ganhos líquidos.

---

## 2. Lacunas reais (com severidade e esforço)

Cada lacuna com veredicto. «Desenhado, não construído» = previsto no `DESIGN.md`
mas ainda sem implementação.

### 2.1 Contexto / injecção de dependências — ⚠️ *desenhado, não construído*
- **React:** `createContext`/`useContext` (tema, cliente API, *locale*, auth).
- **dxjs hoje:** nada. *Workaround* real: um **signal em módulo** (singleton) ou
  passar por `props`. Para a maioria dos casos do console (um cliente API, um tema,
  um *locale*) o signal-módulo chega.
- **Esforço:** pequeno/médio (um `createContext` sobre a *owner tree* do `@dxjs/core`
  daria *scoping* por subárvore; opcional).

### 2.2 Error boundaries (`onError`) — ⚠️ *desenhado, não construído*
- **React:** *error boundary* por subárvore.
- **dxjs hoje:** `onCleanup` existe; `onError` está no `DESIGN.md §6` mas não
  implementado. Sem ele, um erro num `effect`/componente não tem contenção por-UI.
- **Esforço:** pequeno (ligar um `onError` à *owner tree*, mostrar *fallback*).

### 2.3 Camada de *cache* de dados (react-query) — ⚠️ lacuna média/grande
- **React:** `@tanstack/react-query` — *cache* por chave, dedupe de pedidos
  concorrentes, invalidação, *stale-while-revalidate*, *retry*, *pagination*.
- **dxjs hoje:** `resource` cobre **um** pedido por-componente (loading/error/abort/
  refetch reactivo), mas **não** partilha *cache* entre componentes nem invalida por
  chave. Dois componentes a pedir o mesmo recurso fazem dois *fetches*.
- **Esforço:** médio. Um `@dxjs/query` (ou `query()` em `@dxjs/transport`) sobre
  `resource` + um `Map` de *cache* por chave com `invalidate(key)` fecharia o grosso.
  É a lacuna com mais impacto num console *data-heavy*.

### 2.4 Virtualização de listas (react-virtual) — ⚠️ lacuna média
- **React:** `@tanstack/react-virtual` para listas/tabelas grandes (logs, recursos).
- **dxjs hoje:** nada; `dataTable` do `@dxjs/ui` pagina mas não virtualiza.
- **Esforço:** médio. Um `virtualList`/`virtualRows` (janela por *scroll* + spacers)
  encaixa no modelo de signals. Necessário para o CloudShell/logs e listas longas.

### 2.5 Formulários (react-hook-form) — ⚠️ lacuna média
- **React:** `react-hook-form` + `@hookform/resolvers` + `zod`.
- **dxjs hoje:** sem *helper* dedicado; **mas** `zod` funciona tal-qual e os signals
  dão *binding* de campos triviais. Falta o açúcar (registo de campos, estados
  *touched/dirty*, erros por campo, *submit* com validação).
- **Esforço:** médio. Um `@dxjs/forms` fino (campos como signals + `zod` para
  validação + estados por campo) cobre o console sem reinventar validação.

### 2.6 Custom elements / Shadow DOM (`defineElement`) — ⚠️ *desenhado, não construído*
- Previsto (`DESIGN.md §6`), opcional (interop/scoping de estilos). **Não** é
  necessário para o console. Esforço pequeno quando se quiser.

### 2.7 Ecossistema / DevTools / testing-library — ℹ️ gap assumido
- React tem DevTools, `@testing-library/react`, enorme ecossistema. dxjs testa com
  `node:test`+happy-dom (unit) e Playwright (browser/CSP) — suficiente e já em uso no
  console (Playwright, Testing Library). **DevTools** de signals seria *nice-to-have*,
  não bloqueador.

### Não são lacunas (apesar de parecerem)
- **Re-render/memoização** (`memo`, `useCallback`, `useMemo` por performance): o modelo
  *fine-grained* do dxjs **dispensa-os** — não há re-render de componente a optimizar.
- **Suspense/transitions:** `resource.loading` + signals cobrem os padrões de
  carregamento sem a maquinaria de *concurrent React*.
- **Portais:** `render(view, host)` monta em qualquer nó → portais triviais.

---

## 3. Veredicto e recomendação

**Veredicto:** a reescrita do delonix-console em dxjs é **viável e vantajosa**
(tamanho, segurança CSP, SSE), **não** sendo um *drop-in* hoje. O caminho crítico é
pequeno e bem definido.

**Construir *antes* de migrar o console (por prioridade):**
1. **`@dxjs/query`** — *cache*/dedupe/invalidação sobre `resource`. *(maior impacto)*
2. **`virtualList`** — virtualização para logs/listas longas.
3. **`@dxjs/forms`** — campos+`zod`+estados por campo.
4. **`onError`** — *error boundaries* por subárvore.
5. **`createContext`** — DI por subárvore *(opcional; signal-módulo cobre o imediato)*.

**Reutilizar tal-qual (sem port):** `zod`, `i18next` (core), `@xterm/xterm`, `dexie`.
**Já cobertos:** reactividade, DOM, componentes, router (básico), SSR, REST/SSE/gRPC,
grafo de nós (↔ xyflow), kit UI, gráficos.

**Estratégia sugerida:** migrar **uma fatia vertical** do console primeiro (ex.: uma
secção *read-mostly* com uma lista + detalhe), construindo `@dxjs/query` e
`virtualList` nesse processo; medir DX/tamanho/CSP; só então alargar. Router aninhado
e *loaders* tipados avaliam-se quando uma secção os exigir.

**Distância honesta:** ~5 adições focadas (2–3 delas pequenas). O dxjs **não** está
distante — está a uma campanha curta de paridade funcional para *este* console,
com vantagens estruturais que o React não oferece (CSP sem `eval`, bundle ~16× menor,
SSE por-componente).
