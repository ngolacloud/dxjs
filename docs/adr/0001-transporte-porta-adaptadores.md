# ADR 0001 — Transporte agnóstico: porta + adaptadores

> **Estado:** PROPOSTA (fixa o contrato antes de implementar)
> **Data:** 2026-11-25
> **Contexto a montante:** [DESIGN.md](../../DESIGN.md) §7 (transporte), [docs/parity/react-parity.md](../parity/react-parity.md)
> **Decide:** a fronteira de comunicação do dxjs com qualquer backend.

---

## 1. Contexto

O dxjs nasceu como frontend nativo do **Seiva** (framework de serviços em Rust),
mas a diretriz do dono é explícita: **o dxjs tem de servir qualquer backend**, e
tem de funcionar em dois modos de implantação:

- **Separado** do Seiva (ou de outro backend) — fala pela **API pública** (rede).
- **Embebido** no Seiva (servido pelo binário e/ou a correr no SSR, co-localizado)
  — fala por **RPC in-process, rápido e seguro** (sem ida à rede, sem superfície
  pública).

Além disso, "qualquer backend" significa **qualquer protocolo**: REST/JSON,
gRPC (nativo e gRPC-web/Connect), SOAP, e o canal in-process embebido — com
*streaming* em tempo real quando o protocolo o permite.

Hoje o `@dxjs/transport` já tem peças (REST `createClient`, `resource`,
`createLiveSource` SSE multiplexada, `createConnectClient`) e o `@dxjs/edge` tem
gRPC nativo sobre `node:http2` — mas **cada uma é uma API própria**. O código de
aplicação, o `@dxjs/query` e o `@dxjs/forms` acabam acoplados a *um* protocolo.
Trocar de backend ou de modo de implantação obriga a reescrever chamadas.

## 2. Decisão

Adotar uma **arquitectura hexagonal no transporte**: uma **porta** (interface
neutra, mínima) que todo o resto consome, e **adaptadores** (um por protocolo)
que a implementam. O protocolo passa a ser um detalhe de *bootstrap*; o código de
aplicação nunca o vê.

```
app · @dxjs/query · @dxjs/forms · resource · codegen
                      │ dependem só de ↓
                 ┌──────────────┐
                 │   Transport  │  (a PORTA — este ADR fixa-a)
                 └──────────────┘
                      ▲  implementada por
   ┌──────┬───────────┼───────────┬──────────┬───────────┐
  REST  Connect   gRPC-nativo    SOAP     embebido      SSE/WS
 (http) (grpc-web) (node:http2) (xml/http) (in-process) (stream)
```

O **Seiva deixa de ser o núcleo** e passa a ser **um perfil** por cima da porta
(ver §7). Outro backend traz o seu perfil e herda as mesmas garantias.

## 3. O contrato fixado

Estas são as formas estáveis. Os adaptadores e perfis dependem **apenas** delas.

### 3.1 Descriptor de método (neutro de IDL)

Normaliza qualquer IDL (OpenAPI, protobuf, WSDL, registo do Seiva) para uma forma
única que a porta executa.

```ts
export type MethodKind = "unary" | "serverStream";

export interface MethodDescriptor<Req = unknown, Res = unknown> {
  /** Id estável e único do método (ex.: "accounts.create"). */
  readonly id: string;
  /** Serviço/recurso lógico (ex.: "accounts"). */
  readonly service: string;
  /** Nome do método (ex.: "create"). */
  readonly method: string;
  readonly kind: MethodKind;
  /** Pistas que os adaptadores mapeiam ao protocolo (nunca lidas pela app):
   *  REST → {http:{method:"POST", path:"/v1/accounts"}}; gRPC → {grpc:{...}}; etc. */
  readonly wire?: Readonly<Record<string, unknown>>;
  /** Mutação idempotente? Habilita retry seguro + idempotency-key. */
  readonly idempotent?: boolean;
  /** Apenas tipos (apagados em runtime) — ancoram Req/Res para o codegen. */
  readonly __req?: Req;
  readonly __res?: Res;
}
```

### 3.2 Contexto de chamada (política comum, transversal)

```ts
export interface CallCtx {
  /** Cancelamento (ligado ao owner tree — aborta no unmount). */
  signal?: AbortSignal;
  /** Metadados/cabeçalhos neutros; cada adaptador traduz (headers, gRPC metadata…). */
  meta?: Record<string, string>;
  /** Credencial a injectar (Bearer, mTLS ref, token de sessão). */
  auth?: AuthToken;
  /** Propagação de trace (W3C traceparent) p/ correlação com a observabilidade. */
  traceId?: string;
  /** Chave de idempotência p/ mutações (reenvio seguro). */
  idempotencyKey?: string;
  /** Timeout por chamada (ms). */
  timeoutMs?: number;
}
```

### 3.3 A PORTA

```ts
export interface Transport {
  /** Chamada pedido→resposta. */
  unary<Req, Res>(method: MethodDescriptor<Req, Res>, req: Req, ctx?: CallCtx): Promise<Res>;
  /** Stream servidor→cliente (push); base de `liveSignal`/tempo-real. */
  serverStream<Req, Res>(method: MethodDescriptor<Req, Res>, req: Req, ctx?: CallCtx): AsyncIterable<Res>;
  /** O que este adaptador consegue fazer (p/ negociação — §5). */
  readonly caps: TransportCaps;
}

export interface TransportCaps {
  serverStream: boolean;  // stream nativo? (gRPC-stream, SSE)
  bidi: boolean;          // bidirecional? (WS, gRPC-bidi)
  binary: boolean;        // payload binário? (protobuf, embebido) vs só JSON/texto
  inProcess: boolean;     // sem rede (embebido)
}
```

### 3.4 Adaptador = fábrica de `Transport`

```ts
export type Adapter = (options: unknown) => Transport;
// restAdapter({ baseUrl })  ·  connectAdapter({ baseUrl })
// grpcNativeAdapter({ authority })  ·  soapAdapter({ endpoint, wsdl })
// embeddedAdapter({ invoke })  ·  (sseAdapter/wsAdapter alimentam serverStream)
```

### 3.5 Interceptores (a política vive na porta, não no protocolo)

Auth, retry, trace e logging são **middleware** sobre a porta — funcionam igual em
qualquer adaptador:

```ts
export type Interceptor = (next: Transport) => Transport;
export function withInterceptors(base: Transport, ...mw: Interceptor[]): Transport;
// ex.: withInterceptors(rest, authInterceptor(session), retry({ max: 3, jitter: true }), tracing())
```

### 3.6 Cliente tipado por cima da porta

```ts
export function createClient(transport: Transport): {
  call<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx?: CallCtx): Promise<Res>;
  live<Req, Res>(m: MethodDescriptor<Req, Res>, req: Req, ctx?: CallCtx): AsyncIterable<Res>;
};
```

`resource()`, `@dxjs/query` e `@dxjs/forms` passam a receber um `Transport`
(ou um `createClient`), **nunca** `fetch` nem um protocolo.

## 4. Adaptadores (matriz)

| Protocolo | Adaptador | Pacote | IDL → descriptor | Ambiente |
|---|---|---|---|---|
| REST/JSON | `restAdapter` | `@dxjs/transport` (existe) | OpenAPI | browser + node |
| gRPC-web/Connect | `connectAdapter` | `@dxjs/transport` (existe) | protobuf | browser + node |
| gRPC nativo | `grpcNativeAdapter` | `@dxjs/edge` (existe) | protobuf | node/edge |
| SOAP | `soapAdapter` | `@dxjs/soap` (novo) | WSDL | browser(HTTPS)+node |
| **RPC embebido** | `embeddedAdapter` | `@dxjs/embedded` (novo) | registo do backend | **servidor/SSR** |
| tempo-real | `sseAdapter`/`wsAdapter` | `@dxjs/transport` (SSE existe) | — | browser + node |

**Modo embebido (o caminho rápido e seguro).** Quando o dxjs corre dentro/ao lado
do Seiva (SSR, co-localizado, ou servido pelo binário), `embeddedAdapter({ invoke })`
chama o *handler* diretamente — in-process ou por *unix socket* local — contra o
mesmo registo de serviços:

```ts
// invoke é fornecido pelo host (Seiva): despacha o descriptor para o handler real.
const embedded = embeddedAdapter({ invoke: (m, req, ctx) => seivaDispatch(m.id, req, ctx) });
```

- **Rápido:** sem *round-trip* HTTP, sem serialização pública (zero-copy quando possível).
- **Seguro:** a API não fica exposta na rede; canal de confiança por construção.

A **mesma app** corre sobre `embeddedAdapter` (embebido) e sobre `restAdapter`/
`connectAdapter` (separado) — só o *bootstrap* troca.

## 5. Negociação de capacidades e degradação graciosa

`liveSignal`/tempo-real consulta `transport.caps` e escolhe o melhor caminho,
sempre atrás da **mesma** API:

```
serverStream nativo (gRPC-stream)  →  senão SSE  →  senão long-poll
```

O código de aplicação pede `client.live(descriptor, req)` e recebe um
`liveSignal`; não sabe nem quer saber qual o mecanismo por baixo.

## 6. Segurança por adaptador, política comum

- **Browser (CSP estrita):** sem `eval`/inline; REST/Connect/SOAP sobre `fetch`/HTTPS;
  token via interceptor; Trusted Types respeitado.
- **node/edge:** mTLS, gRPC nativo, SOAP sobre TCP.
- **Embebido:** canal in-process de confiança — sem exposição de rede.
- Transversal (na porta, via interceptores): injecção de auth, propagação de
  `traceparent`, `idempotencyKey`, *timeouts*, *retry* com *backoff*+jitter.

## 7. O Seiva como perfil (não como núcleo)

`@dxjs/seiva` fica **sobre** a porta e contém só o que é específico do Seiva:

1. *codegen* `/openapi.json` (+ WireSchema) → `MethodDescriptor`s tipados + validadores `@dxjs/forms`;
2. mapeamento do **envelope de erro** do Seiva → modelo de erro do `@dxjs/transport`
   (campos→forms, 401/403 scope/BOLA, 409/412 concorrência optimista DORM);
3. ligação dos **eventos** do Seiva (command bus) ao `serverStream` → invalidação do `@dxjs/query`.

Tudo isto funciona sobre **qualquer** adaptador — logo, `embeddedAdapter` (embebido)
e `restAdapter` (separado) dão o mesmo comportamento. Outro backend escreve o seu
perfil (`@dxjs/openapi` genérico, ou um perfil gRPC) e herda os mesmos primitivos.

## 8. Consequências

**Positivas**
- Um backend/protocolo/modo de implantação ⇒ troca de adaptador, zero mudanças na app.
- O caminho embebido entrega latência mínima e **sem superfície de rede**.
- Núcleo continua minúsculo: adaptadores são **opt-in e *tree-shakeable*** (quem só
  usa REST não embarca SOAP/gRPC).
- `@dxjs/query`/`forms`/`resource` testam-se contra um `Transport` *fake* trivial.

**Custos / limites honestos**
- **O browser não fala tudo:** gRPC nativo e SOAP-sobre-TCP e o `embeddedAdapter`
  in-process são **de servidor** (SSR/edge); no browser é REST, Connect/gRPC-web e
  SOAP-sobre-HTTPS. A porta é a mesma; as `caps` diferem (daí a §5).
- Uma indireção a mais no transporte (mitigada: a porta é fina; os interceptores são opt-in).
- Normalizar cada IDL para `MethodDescriptor` é trabalho de *codegen* por protocolo.

## 9. Alternativas consideradas

1. **Um cliente por protocolo (status quo).** Rejeitada: acopla a app ao protocolo;
   trocar de backend/modo reescreve chamadas.
2. **Só REST + "o resto é problema de um gateway".** Rejeitada: perde o caminho
   embebido rápido/seguro e o gRPC/stream nativo; empurra latência e um salto extra.
3. **Adoptar um SDK externo (ex.: Connect-ES) como base.** Rejeitada como *núcleo*:
   traria dependência e peso; fica como **um** adaptador possível, não como a porta.

## 10. Plano de implementação (sessões seguintes, fora deste ADR)

1. Extrair a porta `Transport` + `MethodDescriptor` + `CallCtx`; reconduzir
   `resource`/`query`/`forms` para dependerem só dela; reembrulhar REST/Connect/
   gRPC-nativo existentes como adaptadores (sem partir a API atual).
2. `embeddedAdapter` (in-process) + negociação de capacidades (§5).
3. `@dxjs/codegen` neutro (OpenAPI → descriptors; protobuf/WSDL a seguir).
4. Perfil `@dxjs/seiva` (§7), provado contra o `admin-e2e` real em **dois adaptadores**
   (REST remoto *e* embebido) com o **mesmo** código de app — a prova de que a
   arquitectura está correcta.
