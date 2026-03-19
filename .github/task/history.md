# History — TODOs Concluídos

---

## [2026-03-15] Review & Fix — Revisão de segurança da feat(database)/full-database-schema
> Branch: `feat(database)/full-database-schema`

### Bugs corrigidos
- [x] `package.json` — scripts `dev`/`build`/`start` apontavam para `src/index.ts` inexistente → corrigido para `src/main.ts`/`dist/main.js`
- [x] `device-auth.plugin.ts` — lookup de device sem `deviceId` era não-determinístico em orgs com múltiplos ESP32 → adicionado header `X-Device-Id` + query por `(orgId, deviceId, isActive)`
- [x] `.gitignore` — cobria apenas `apps/api-core/node_modules` → expandido para `**/node_modules`

### Documentação atualizada
- [x] `docs/backend/README.md` — ADR-004 adicionado na tabela de ADRs
- [x] `docs/backend/manuais/autenticacao.md` — passkey marcado como indisponível; RBAC corrigido (removidos `members:manage`/`admin:*`); fluxo IoT atualizado com `X-Device-Id`; nomenclatura `authPlugin`/`deviceAuthPlugin` corrigida
- [x] `docs/backend/manuais/configuracao.md` — variáveis `BETTER_AUTH_TRUSTED_ORIGINS` e `PORT` adicionadas
- [x] `docs/backend/arquitetura/hexagonal.md` — bootstrap order corrigido (CORS + `mount(auth.handler)` presentes)
- [x] `docs/database/manuais/migrations.md` — migrations 0010–0014 adicionadas à lista

---

## [2026-03-15] Refactor — Migração para Arquitetura Hexagonal Definitiva
> Branch: `feat(database)/full-database-schema`

### Ficheiros movidos/renomeados
- [x] `src/index.ts` → `src/main.ts` (entry point mais expressivo)
- [x] `src/app.ts` → `src/infrastructure/server.ts` (bootstrap = infraestrutura)
- [x] `src/infrastructure/plugins/auth.plugin.ts` → `src/adapters/http/auth.plugin.ts`
- [x] `src/infrastructure/plugins/device-auth.plugin.ts` → `src/adapters/http/device-auth.plugin.ts`
- [x] Pasta `src/infrastructure/plugins/` removida

### Scaffolding criado
- [x] `src/core/use-cases/.gitkeep`
- [x] `src/adapters/repositories/.gitkeep`
- [x] `src/adapters/queue/.gitkeep`

### Documentação
- [x] `docs/backend/adrs/ADR-004-estrutura-pastas-modularizacao.md` criado
- [x] `docs/backend/arquitetura/hexagonal.md` atualizado (estrutura de pastas real)
- [x] `docs/backend/README.md` — ADR-004 adicionado à tabela

### Verificação
- [x] `bun run typecheck` — zero erros ✅
- [x] `bun --hot src/main.ts` inicia sem erros ✅
- [x] `GET /api/auth/ok` → `{ ok: true }` ✅

---

## [2026-03-14] Fase Database — Better Auth Tables + auth.ts
> Branch: `feat(database)/full-database-schema`

### Fase 1 — Better Auth Drizzle Schema
- [x] Criar `apps/api-core/src/infrastructure/database/schema/auth-schema.ts`
  - Tables: authUsers, authSessions, authAccounts, authVerifications, authOrganizations, authMembers, authInvitations, authPasskeys
  - ⚠️ Passkey não disponível no better-auth 1.5.5 — tabela existe no schema/migrations para uso futuro
- [x] Editar `schema/index.ts` — `export * from './auth-schema'` adicionado

### Fase 2 — SQL Migrations
- [x] `0011_create_auth_core_tables.sql` — auth_users, auth_sessions, auth_accounts, auth_verifications
- [x] `0012_create_auth_organization_tables.sql` — auth_organizations, auth_members, auth_invitations
- [x] `0013_create_auth_passkey_tables.sql` — auth_passkeys (futura ativação ao atualizar better-auth)
- [x] `0014_add_members_user_fk.sql` — FK members.user_id → auth_users(id)
- [x] Atualizar `meta/_journal.json` — entries idx 10–13

### Fase 3 — auth.ts
- [x] Criar `apps/api-core/src/infrastructure/auth.ts`
  - drizzleAdapter + mapeamento auth_* tables
  - Plugins: organization, multiSession(max:3)
  - emailAndPassword.enabled: true
  - advanced.database.generateId: 'uuid'
  - RBAC: admin→all | professor→attendance:write,read | rh→attendance:read,reports:read | student→[read]
  - trustedOrigins de env var

### Fase 4 — Documentação
- [x] `docs/database/arquitetura/schema.md` atualizado
- [x] `docs/database/README.md` atualizado

### Verificação
- [x] `bun run typecheck` — zero erros ✅
- [x] `bun run db:migrate` — 14 migrations, 15 tabelas ✅
