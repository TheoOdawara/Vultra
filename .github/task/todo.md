# TODO — Plano Ativo

> Branch: `feat(database)/full-database-schema`
> Data: 2026-03-15
> Objetivo: Implementar primeira rota de domínio (Fase 6)

## Próximo Passo — Fase 6: Primeira rota de domínio

A estrutura hexagonal está completa. A próxima fase é implementar a primeira rota real, seguindo o padrão:
`adapters/http/*.routes.ts` → `core/use-cases/*.use-cases.ts` → `adapters/repositories/*.repo.ts`

### Sugestão de ordem
- [ ] `adapters/repositories/members.repo.ts` — CRUD básico de membros com filtro organizationId
- [ ] `core/use-cases/members.use-cases.ts` — CreateMember, ListMembers, DeactivateMember
- [ ] `adapters/http/members.routes.ts` — `/v1/members` (GET, POST) com TypeBox
- [ ] Registar rota no `infrastructure/server.ts` dentro do grupo `/v1`
- [ ] `bun run typecheck` — zero erros ✅