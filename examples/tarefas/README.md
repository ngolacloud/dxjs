# Tarefas — do backend ao frontend

Uma lista de tarefas completa e partilhada: abre-a em dois separadores, cria ou
marca uma tarefa num e vê o outro actualizar ao vivo.

- **server/** — Node.js sem dependências: uma API REST (`/v1/tasks`), um feed
  SSE (`/v1/tasks/stream`) que envia a lista a cada alteração, e a app web
  compilada, tudo na mesma origem e servido com uma CSP estrita
  (`script-src 'self'`, `connect-src 'self'`).
- **web/** — dxjs: as operações descritas uma vez (`src/api.ts`), um só cliente
  que faz as chamadas por REST e recebe a lista por SSE (`composeTransport`), e a
  interface com `@dxjs/ui` (`src/app.ts`).

## Correr

```sh
cd web
npm install          # os pacotes @dxjs/* vêm da GitHub Release, não do registo npm
npm run build        # ou: npm run watch, para recompilar a cada gravação
cd ../server
npm start            # → http://127.0.0.1:8000
```

Precisa de Node.js 20 ou mais recente.

## Trocar o backend

O frontend só depende de quatro rotas HTTP. Qualquer backend que as sirva na
mesma origem — Python, Go, Rust, PHP, Java — funciona sem mudar uma linha em
`web/`: o guia de transporte do dxjs mostra estas rotas em sete linguagens.
