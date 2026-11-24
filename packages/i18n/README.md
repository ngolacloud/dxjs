# @dxjs/i18n

A tiny, CSP-safe i18n layer for dxjs with a **reactive locale**, built on
`@dxjs/core` signals and the platform `Intl` API. Defaults to Angolan Portuguese
(**pt-AO**) and the Kwanza (**AOA**, `Kz`).

```ts
import { createI18n } from "@dxjs/i18n";

const i18n = createI18n({
  fallbackLocale: "pt-AO",
  messages: {
    "pt-AO": { greeting: "Olá, {name}!", nav: { users: "Utilizadores" } },
    "en-US": { greeting: "Hello, {name}!" },
  },
});

i18n.t("greeting", { name: "Ana" }); // "Olá, Ana!"
i18n.currency(1234.5);               // "1 234,50 Kz"
i18n.n(1234567.89);                  // "1 234 567,89"

// Reactive: any binding that read t/n/d re-derives when the locale changes.
i18n.setLocale("en-US");
```

Translation is dictionary lookup + `{param}` string interpolation — no `eval`,
no `new Function`, no data templating — so it runs under a strict CSP.

Out of scope (later): pluralization/ICU select, message extraction, lazy
per-locale loading, RTL.
