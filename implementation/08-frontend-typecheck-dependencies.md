# 08 - Typecheck e Dependencias Frontend

## Objetivo

Fazer os tres portais passarem em typecheck e remover dependencias proibidas/desnecessarias.

## Problemas Confirmados Ou Provaveis

- `passkeyClient` e importado no admin, mas passkeys nao estao habilitadas/disponiveis de forma consistente no projeto.
- `next-env.d.ts` nao existe nos tres frontends.
- Casts de query para `Record<string, string | number | boolean | undefined>` sao frageis.
- `zod` foi adicionado apesar da proibicao do projeto.
- `@hookform/resolvers` parece desnecessario se `zod` for removido.

## Escopo

Arquivos provaveis:

- `apps/frontend-admin/package.json`
- `apps/frontend-professores/package.json`
- `apps/frontend-rh/package.json`
- `apps/frontend-admin/src/lib/auth-client.ts`
- `apps/frontend-*/src/lib/api.ts`
- `apps/frontend-*/next-env.d.ts`
- `apps/frontend-*/tsconfig.json`

## Tarefas

1. Remover `passkeyClient` de `frontend-admin/src/lib/auth-client.ts`.
2. Manter apenas plugins Better Auth realmente disponiveis e usados.
3. Criar `next-env.d.ts` nos tres frontends.
4. Corrigir `buildQuery` usando tipos concretos por client ou helper seguro sem `any`.
5. Remover `zod` dos tres `package.json`.
6. Remover `@hookform/resolvers` se nao houver uso real.
7. Garantir que `@vultra/types` resolve via tsconfig ou workspace.
8. Rodar instalacao de dependencias quando necessario para atualizar lockfiles.

## Criterios De Aceite

- `bun run typecheck` passa nos tres frontends.
- Nenhum frontend depende de Zod/Joi/Yup.
- Nenhum import CSS falha por falta de declaracao Next.
- Nenhum cast inseguro e necessario para montar query string.

## Verificacao

```bash
bun run typecheck
```

Diretorios:

```bash
apps/frontend-admin
apps/frontend-professores
apps/frontend-rh
```
