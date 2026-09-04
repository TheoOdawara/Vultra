# apps/web — portal do Vultra

App único do portal, conforme a SPEC-003 (`docs/specs/frontend-portal-forma-final.md`).
Next.js 15 App Router, React 19, Tailwind v4, Biome, Vitest.

## Ambiente

Toda variável é obrigatória e validada no boot por `src/shared/env/env.ts`. Não há valor
padrão em nenhum ambiente (ADR-0001 §6): faltando variável, o build falha nomeando-a.

| Variável | Formato |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | URL absoluta, sem barra final |
| `NEXT_PUBLIC_APP_URL` | URL absoluta, sem barra final |

## Comandos

```
bun install
bun run lint        # biome check .
bun run typecheck   # tsc --noEmit
bun run test        # vitest run
bun run build       # next build
bun run dev
```

O portão roda do mais barato ao mais caro, todos com exit 0, zero erro e zero aviso.
`lint`, `build` e `dev` exigem as duas variáveis no ambiente; `test` recebe valores
próprios pelo `vitest.config.ts`.

## Teste

Vitest com jsdom e Testing Library. MSW intercepta na rede, então o cliente de API é
exercitado de verdade em vez de substituído por dublê. Requisição para rota sem handler
declarado reprova o teste. O servidor compartilhado vive em `src/test/msw.ts`.

Playwright (#125) e axe-core (#126) ainda não existem aqui.
