# dxjs — Documento de Desenho Técnico

> **Estado:** PROPOSTA (para aprovação antes de escrever código)
> **Repositório alvo:** `github.com/ngolacloud/dxjs`
> **Contexto:** motor de UI leve para o console NgolaCloud/Seiva, nascido da auditoria ao StillJS (ver `seiva/audit/`). Clean-room — reaproveita ideias, não o código `eval`-based.

---

## 1. Objectivos e não-objectivos

### Objectivos
1. **Compatibilidade 100% com os principais browsers** (matriz na §2), sem polyfills exóticos.
2. **Bundle limpo, pequeno e performático** — zero dependências em tempo de execução, *tree-shakeable*, orçamento de tamanho rígido (§9).
3. **Seguro por construção** — sem `eval`/`new Function`, sem handlers inline, *escape* por omissão, compatível com CSP estrita hash-pinned e com **Trusted Types** (§10). Passa o portão `SecurityAdapter.csp()` do blueprint da auditoria.
4. **Pronto para REST** — cliente `fetch` tipado, com `AbortController`, interceptores e cancelamento no *unmount* (§7.1).
5. **gRPC quando co-localizado** — transporte que escolhe o melhor protocolo por ambiente: browser → Connect/gRPC-Web; servidor/edge adjacente ao backend → **gRPC nativo HTTP/2** (§7.2).
6. **SSE com *update* em tempo real por componente, sem carga no servidor** — **uma** ligação partilhada, multiplexada por tópicos, *push* só de deltas, ponte directa para *signals* → *patch* cirúrgico do DOM (§7.3).
7. **Pronto para edge compute moderno** — runtime só com APIs Web-standard (fetch/streams/WHATWG), SSR com *streaming* e hidratação (§8).

### Não-objectivos (explícitos)
- **Não** ser o React nem replicar o seu ecossistema/VDOM/Fiber. dxjs é *fine-grained reactive* (sem VDOM), o que dá performance e tamanho pequeno.
- **Não** impor passo de *build* em desenvolvimento (ESM nativo corre directo; *build* só para produção).
- **Não** fazer autorização no cliente — authz é sempre no backend (lição SEC-007 da auditoria).

---

## 2. Matriz de compatibilidade de browsers

Alvo: **Baseline «Widely Available»** (recursos com ≥30 meses em todos os motores). Todas as primitivas que o dxjs usa estão amplamente suportadas há anos.

| Browser | Versão mínima | Notas |
|---|---|---|
| Chrome / Edge (Chromium) | 90+ | 2021+ |
| Firefox | 90+ | 2021+ |
| Safari / iOS Safari | 15+ | `Proxy`, Custom Elements, `EventSource`, `AbortController` todos OK |
| Samsung Internet | 15+ | derivado Chromium |

Primitivas-base e suporte: `Proxy`/`Reflect` (reactividade), `<template>`+`cloneNode` (renderização), `WeakRef`/`FinalizationRegistry` (opcional, com *fallback*), `EventSource` (SSE), `fetch`/`ReadableStream` (transporte), Custom Elements v1 + Shadow DOM (isolamento opcional). **Nenhuma depende de API não-standard.**

- **Build moderno** (por omissão): ESM, ES2021. **Build *legacy* opcional**: ES2017 + nomodule para alvos antigos.
- *Feature detection* em vez de *UA sniffing*; degradação graciosa (ex.: sem `WeakRef` → registo manual de *teardown*, que já existe sempre).

---

## 3. Arquitectura em camadas + árvore de pastas

Camadas estritas, dependência só para baixo (cada uma publicável/*tree-shakeable* isolada):

```
@dxjs/core        → reactividade (signal/computed/effect/batch/untrack)
@dxjs/dom         → html`` + render + bind + escape + teardown  (depende de core)
@dxjs/component   → componentes, ciclo de vida, contexto, router (depende de dom)
@dxjs/transport   → rest + connect(grpc-web) + grpc-nativo + sse (depende de core)
@dxjs/server      → SSR streaming + hidratação + adaptadores edge (depende de dom)
@dxjs/devtools    → inspector de signals/grafo (dev only)
@dxjs/cli         → scaffold, build, análise de bundle
```

```
dxjs/
├── packages/
│   ├── core/           src/{signal,computed,effect,batch,scheduler,owner}.ts  + test/
│   ├── dom/            src/{html,render,bind,directives,escape,trusted-types}.ts
│   ├── component/      src/{component,lifecycle,context,router,portal}.ts
│   ├── transport/      src/{client,rest,connect,grpc,sse,resource,codec}.ts
│   ├── server/         src/{render-to-stream,hydrate,edge/{cloudflare,deno,vercel,node}}.ts
│   ├── devtools/
│   └── cli/
├── examples/           console-seiva/ , datapipeline-canvas/ (F5)
├── docs/               (Diátaxis; MkDocs ou dxjs a servir-se a si próprio)
├── bench/              tamanho de bundle + micro-bench de render/reactividade
├── .github/workflows/  ci: lint, size-budget, csp-render, browser-matrix (Playwright)
├── package.json  (workspace)  ·  tsconfig  ·  biome/eslint  ·  LICENSE (MIT/Apache-2.0)
```

Linguagem: **TypeScript** (compila para ESM limpo; emite `.d.ts`). TS é ferramenta de desenvolvimento — o artefacto publicado é JS + tipos. (Corrige GAP-03 da auditoria.)

---

## 4. Modelo de reactividade — *signals* (fine-grained)

Núcleo minúsculo (~1–2 KB) ao estilo Solid/Preact-signals. Sem VDOM, sem *diffing* de árvore: cada ligação no DOM é um `effect` que só re-executa quando os seus *signals* mudam → *update* cirúrgico.

```ts
const count = signal(0);                 // estado reactivo
const double = computed(() => count() * 2);
effect(() => console.log(double()));     // re-corre só quando count muda
count.set(1);                            // ou count(v => v+1)
batch(() => { ... });                    // agrupa mutações, 1 flush
untrack(() => count());                  // lê sem criar dependência
```

- **Scheduler** com micro-task *batching* (coalesce de *updates* no mesmo *tick*; opção `requestAnimationFrame` para DOM).
- **Owner/cleanup tree**: cada `effect`/componente tem um *owner*; ao destruir, corre todos os `onCleanup` registados → **teardown real** (corrige BUG-002/leaks da auditoria). Sem `setTimeout` para ordenar nada (corrige BUG-004).

---

## 5. Renderização — `html``` seguro, sem `eval`

Tagged-template compilada **uma vez** para um `<template>` clonável; as interpolações viram marcadores com *bindings* ligados a `effects`.

```ts
const view = html`
  <section class="card">
    <h2>${() => user().name}</h2>           <!-- texto: textContent, escapado -->
    <input .value=${() => draft()} @input=${onInput}>  <!-- prop + evento -->
    <ul>${list(items, (it) => html`<li>${() => it.label}</li>`)}</ul>
  </section>`;
```

Regras inquebráveis (o oposto do StillJS):
- Texto → `textContent` / nós de texto; **nunca** `innerHTML` de dados. *Escape* por omissão.
- Atributos/propriedades → `setAttribute`/propriedade directa; URLs passam por *sanitizer* de esquema (bloqueia `javascript:`).
- Eventos → **`addEventListener`** com referência; removidos no *teardown* (sem `on*=` inline → compatível com CSP sem `unsafe-inline`).
- HTML cru só via directiva explícita `unsafeHtml(x)` que **obriga** a passar por sanitizador (ou Trusted Types policy).
- Listas → directiva `list()` com *keying* e reconciliação por chave (move/insere/remove nós; **não** reconstrói tudo — corrige o O(N) do StillJS). Virtualização opcional para tabelas grandes (§, F3).

Opção de **compilador AOT** (F2): o mesmo `html``` pode ser pré-compilado pelo CLI para instruções DOM directas (menos trabalho em runtime, bundle menor). Em dev corre interpretado (sem build); em prod, compilado. (É uma das decisões em aberto — ver §13.)

---

## 6. Componentes, ciclo de vida, router

**Componentes como funções** (estilo Solid), que correm **uma vez** e devolvem uma `view`; a reactividade vive nos *signals*, não em re-execuções do componente.

```ts
export function UserCard(props: { id: Signal<string> }) {
  const user = resource(() => api.users.get(props.id()));  // async + cancelável
  onMount(() => { /* ... */ });
  onCleanup(() => { /* libertado automaticamente */ });
  return html`<div class="card">${() => user.loading() ? 'A carregar…' : user().name}</div>`;
}
mount(UserCard, document.querySelector('#app'), { id: routeParam('id') });
```

- Ciclo de vida: `onMount`, `onCleanup`, `onError` (*error boundary* por componente). Sem fases sequenciadas por `setTimeout`.
- **Isolamento opcional** via Custom Element + Shadow DOM (`defineElement('dx-user-card', UserCard)`) para interop e *scoping* de estilos — à escolha, não obrigatório.
- **Router** (`@dxjs/component`): baseado na History API, *code-splitting* por rota (`import()` com SRI), guardas **só-UX** (authz no backend), *deep-linking*, limpeza de *subscriptions* na saída.

---

## 7. Camada de transporte (o diferenciador)

Abstracção `Client` única; o protocolo é escolhido por ambiente e por serviço. Tudo sobre `fetch`/streams standard (→ funciona no browser **e** no edge).

### 7.1 REST
```ts
const api = createClient({ baseUrl: '/v1', auth: () => bearer() });
const r = await api.get('/users', { signal });   // AbortController ligado ao owner
```
- Cancelamento automático no *unmount* (liga `signal` ao *owner* do componente) → corrige SEC-010/BUG-001 e o problema de resposta obsoleta (geração verificada no *apply*).
- Interceptores (auth, retry com *backoff*, *dedup* de pedidos idênticos em voo), erros tipados (RFC 9457 *Problem* do Seiva).

### 7.2 gRPC — honesto e por ambiente
> O browser **não faz gRPC/HTTP-2 nativo** (sem acesso a *trailers*). Resolução correcta:

| Ambiente | Protocolo | Como |
|---|---|---|
| Browser | **Connect** (connectrpc) ou gRPC-Web | unário + *server-streaming* sobre HTTP/1.1+2, sem *proxy* se o backend falar Connect (o backend Rust/tonic pode expor Connect) |
| dxjs no **servidor/edge co-localizado** | **gRPC nativo HTTP/2** | ligação servidor-a-servidor plena (unary + bidi streaming) quando o runtime o permite (Node http2 / `fetch` HTTP/2 no edge) |

```ts
const svc = createClient({ proto: 'connect', descriptor: CatalogService });
const items = svc.list({ page: 0 });           // tipado a partir do .proto
```
O código do componente é o mesmo; só muda o transporte injectado. Codecs: protobuf (binário) com *fallback* JSON.

### 7.3 SSE em tempo real, por componente, sem carga no servidor
Desenho que cumpre literalmente o requisito «cada componente actualiza o conteúdo ligado em tempo real sem gerar carga no servidor»:

- **Uma** ligação `EventSource` partilhada por cliente (singleton), **não** uma por componente.
- Registo de **tópicos**: um componente faz `subscribe(topic)` → devolve um `signal` que recebe os deltas; ao *unmount*, `unsubscribe` automático (owner cleanup).
- O servidor faz *push* **só quando há mudança** (orientado a eventos, não *polling*) e envia **deltas**, não estados inteiros; `Last-Event-ID` para retomar sem perder eventos.
- Chegada do evento → actualiza o `signal` → `effect` faz *patch* cirúrgico só do nó ligado. Carga no servidor = 1 ligação aberta + bytes só na mudança. Coalescência opcional de eventos no mesmo *tick*.

```ts
const price = liveSignal('ticker:AO-BONDS', { initial: 0 });  // multiplexado na ligação partilhada
return html`<span>${() => fmt(price())}</span>`;               // actualiza em real-time
```
- *Fallback* configurável: WebSocket (bidi) ou *long-poll* quando SSE não for viável; mesma API `liveSignal`.

---

## 8. SSR, hidratação e edge compute

- **`@dxjs/server`**: `renderToStream(App)` → HTML em *streaming* (Web `ReadableStream`), sem DOM (usa um renderer de strings com o mesmo `html```). *Escape* idêntico ao cliente.
- **Hidratação** progressiva: o cliente anexa *effects* aos nós já presentes (marcadores), sem reconstruir — hidratação *fine-grained* (só os nós reactivos). Opção de *islands* (hidratar só partes).
- **Adaptadores edge**: Cloudflare Workers, Deno Deploy, Vercel Edge, Fastly, Node — todos sobre APIs Web-standard. Sem APIs Node-only no caminho crítico.
- **CSP na origem**: o `@dxjs/server` emite o asset + calcula o **hash SHA-256** que casa com o `admin_csp()` do Seiva (integra-se directamente no console existente sem relaxar a política).

---

## 9. Bundle, build e orçamento de tamanho

- **Dev:** ESM nativo, *import maps*, zero *build* (recarrega e corre).
- **Prod:** CLI (`dx build`) sobre esbuild/rolldown → ESM minificado, *tree-shaken*, *code-split* por rota, *hashing* + SRI, e o hash CSP. Build *legacy* opcional (nomodule).
- **Zero dependências em runtime.** **Lockfile** comprometido (corrige SEC-009).
- **Orçamento (gate de CI, falha o build se exceder):**

| Pacote | Alvo (min+gzip) |
|---|---|
| `@dxjs/core` | ≤ 2 KB |
| `core`+`dom`+`component` (app mínima) | ≤ 10 KB |
| `transport` (rest+sse) | ≤ 4 KB |
| gRPC/Connect (opcional, só se importado) | ≤ 6 KB |

(Referência: React+ReactDOM ≈ 45 KB gzip; o alvo do dxjs para uma app completa é uma fracção disso.)

---

## 10. Segurança (portão obrigatório)

- **Sem `eval`/`new Function`** em lado nenhum — *grep gate* no CI falha o build se aparecer (regra directa da auditoria).
- **Sem handlers inline** — só `addEventListener`.
- ***Escape* por omissão**; HTML cru só via `unsafeHtml` + sanitizador/Trusted Types.
- **Trusted Types** compatível: `@dxjs/dom` instala uma *policy* e nunca atribui strings a *sinks* perigosos directamente.
- **CSP:** funciona sob `default-src 'none'; script-src 'self' 'sha256-…'` sem `unsafe-eval`/`unsafe-inline`. SRI em todos os *chunks*.
- **Sanitização de URL** (bloqueia `javascript:`/`data:` perigosos em `href`/`src`).
- **authz só no backend**; router/visibilidade são UX. Nunca guardar segredos em `localStorage`.
- **Sem globais** (`window[...]`); todo o estado em escopo de módulo/owner (corrige SEC-008).

---

## 11. Testes, CI e qualidade

- **Unit:** Vitest + happy-dom (reactividade, render, teardown, transporte).
- **Browser/E2E:** Playwright sobre a matriz (Chromium/Firefox/WebKit) — reutiliza o padrão já existente no Seiva (`e2e/admin`).
- **Gates de CI:** `no-eval` grep · *size budget* (§9) · **teste de render sob CSP estrita** (prova que renderiza sem `unsafe-*`) · corpus de XSS (nenhuma execução) · matriz de browsers · *memory-leak test* (navegar N vezes → *listeners*/nós estáveis).
- **Tipos:** `.d.ts` publicados; API pública versionada por SemVer com testes de contrato.

---

## 12. Resumo da API pública (superfície estável)

```
@dxjs/core       signal, computed, effect, batch, untrack, onCleanup, createOwner
@dxjs/dom        html, render, list, show, unsafeHtml, defineElement, trustedPolicy
@dxjs/component  component, mount, onMount, onError, createContext, useContext, Router, routeParam, Portal
@dxjs/transport  createClient (rest|connect|grpc), resource, liveSignal, subscribe
@dxjs/server     renderToStream, hydrate, edgeAdapter
```

---

## 13. Milestones e critérios de aceitação

| Fase | Entrega | Esforço | Aceitação |
|---|---|---|---|
| **F0** | `@dxjs/core` (signals/effect/owner/scheduler) + testes | L | 100% dos testes de reactividade; teardown liberta tudo; ≤ 2 KB |
| **F1** | `@dxjs/dom` (`html`/bind/list/escape) + `@dxjs/component` (ciclo+router) | L | Componente renderiza **sob CSP estrita sem `unsafe-*`**; grep `no-eval` verde; app mínima ≤ 10 KB |
| **F2** | CLI/build (compilador AOT opcional) + SSR/hidratação + CI gates | M–L | *Size budget* + CSP-render + matriz Playwright verdes; hash SSR casa com `admin_csp()` |
| **F3** | `@dxjs/transport` (REST+SSE multiplexado+Connect) + lib de componentes (forms do WireSchema, **tabela virtualizada**, modais, notificações) | L–XL | Console Seiva renderizado por dxjs; `liveSignal` prova *update* em tempo real com 1 ligação |
| **F4** | gRPC nativo no servidor/edge + adaptadores edge | M–L | gRPC servidor-a-servidor co-localizado provado; corre em ≥2 runtimes edge |
| **F5** | Canvas: grafo de nós para **data pipelines** e **diagramas de arquitectura** (nós, arestas, *drag*, zoom/pan, serialização) | XL | Desenhar e serializar um pipeline e um diagrama; exemplo publicado |

**Fundo de esforço honesto:** protótipo F0 a correr em 1–2 sessões; F0–F1 sólidos ~1–2 semanas dedicadas de 1 pessoa; dxjs de produção (F0–F3) semanas a poucos meses para equipa pequena; F4 e F5 são subprojectos L–XL cada. Sem datas de calendário sem mais dados.

---

## 14. Decisões (fechadas) e riscos

| # | Decisão | Resultado | Estado |
|---|---|---|---|
| D1 | Estratégia de renderização | **Híbrido:** `html``` runtime em dev (zero build) + compilador AOT opcional em prod. Arranca-se pelo runtime. | ✅ FECHADO 2026-11-05 |
| D2 | Modelo de componente | **Função + signals** (corre uma vez); Web Component (`defineElement`) como *wrapper* opcional para isolamento/interop. | ✅ FECHADO 2026-11-05 |
| D3 | Reactividade | **Signals** + *store* por `Proxy` para objectos aninhados. | ✅ FECHADO 2026-11-05 |
| D4 | Protocolo gRPC no browser | **Connect** (connectrpc), sem *proxy*, com o backend Rust/tonic a expor Connect; gRPC-Web como alternativa futura. | ✅ FECHADO 2026-11-05 |
| D5 | Edge runtimes alvo iniciais | Começar por **Node + Cloudflare Workers**; Deno/Vercel a seguir. | Recomendação (a confirmar em F4) |

Risco maior: F5 (canvas) é grande e independente — tratá-lo como produto à parte, não bloquear F0–F3 com ele.

Risco maior: F5 (canvas) é grande e independente — tratá-lo como produto à parte, não bloquear F0–F3 com ele.
