# apps/web

O painel do Vultra. Pertence ao estágio E2 do SRS; a tecnologia dele é reavaliada quando o E2 for planejado (ADR 0005).

## Stack

Bun como runtime e gerenciador, Next.js 15 App Router, React 19, Tailwind v4, Zod, Biome, Vitest com Testing Library e MSW.

## Convenções

- Toda variável de ambiente é lida em `src/shared/env/env.ts` e em nenhum outro arquivo. As variáveis e seus formatos estão no `README.md` desta pasta.
- Nos testes, o MSW intercepta na rede e o cliente de API roda de verdade. Uma requisição para rota sem handler declarado reprova o teste.

## Comandos

Executados em 2026-10-06, todos com exit 0. `lint`, `build` e `dev` exigem `NEXT_PUBLIC_API_URL` e `NEXT_PUBLIC_APP_URL` no ambiente.

```
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run build
bun run dev
```

Formatação é parte do `bun run lint` (Biome). Não há gate de E2E: Playwright e axe-core ainda não existem aqui (#125, #126).

## Arquitetura

```
src/app          rotas e layouts do App Router
src/shared/api   cliente HTTP, correlation id e mapeamento de erro
src/shared/env   o único módulo que lê ambiente
src/test         setup do Vitest e servidor MSW compartilhado
```

- Uma tela não chama `fetch` direto: usa o cliente de `src/shared/api`.
- `src/shared` não importa de `src/app`.

## Gotchas

- `bun run test` termina com exit 0, mas cada worker emite `ExperimentalWarning: localStorage is not available because --localstorage-file was not provided`, vindo do Node 26. O gate de zero aviso está violado por isso hoje.
- `src/test/types-contract.test.ts` consome `packages/types`, que está congelado com o contrato do backend anterior.
