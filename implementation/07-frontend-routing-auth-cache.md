# 07 - Frontend Routing, Auth e Cache Tenant

## Objetivo

Corrigir problemas de Next.js route groups, dashboard publico, role por portal e cache cross-tenant.

## Problemas Confirmados

- `(dashboard)` e route group; nao cria segmento `/dashboard` na URL.
- Links e redirects usam `/dashboard/*`, gerando 404.
- `/` esta publico nos middlewares, mas renderiza dashboard root.
- Middlewares validam sessao, mas nao role do portal.
- Query keys do TanStack Query nao incluem organizacao ativa.

## Escopo

Arquivos provaveis:

- `apps/frontend-admin/src/middleware.ts`
- `apps/frontend-professores/src/middleware.ts`
- `apps/frontend-rh/src/middleware.ts`
- `apps/frontend-admin/src/app/(dashboard)/*`
- `apps/frontend-professores/src/app/(dashboard)/*`
- `apps/frontend-rh/src/app/(dashboard)/*`
- `apps/frontend-*/src/components/layout/*`
- paginas com `queryKey`

## Tarefas

1. Escolher estrategia de URL:
   - manter `/dashboard/*` e mover paginas para `app/dashboard/*`;
   - ou manter route groups e trocar links para URLs reais como `/members`, `/devices`, `/chamada`.
2. Recomendacao: criar segmento real `app/dashboard/*`, porque links e redirects ja esperam `/dashboard`.
3. Remover `/` de rotas publicas ou criar home publica separada.
4. Garantir que usuario autenticado em `/login` redireciona para rota existente.
5. Adicionar checagem server-side de role por portal.
6. Definir fonte de role: sessao Better Auth/organization membership ou endpoint protegido `/v1/me`.
7. Incluir `activeOrganizationId` nas query keys do TanStack Query.
8. Limpar/invalidate cache ao trocar organizacao ativa.
9. Remover ou criar paginas para links inexistentes como audit/settings/relatorios.

## Criterios De Aceite

- Dashboard nao abre sem sessao.
- Login redireciona para rota existente.
- Links de sidebar nao geram 404.
- Usuario com role errada nao acessa portal indevido.
- Troca de organizacao nao reaproveita cache de outro tenant.

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
