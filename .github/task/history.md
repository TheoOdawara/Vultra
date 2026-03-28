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

---

## [2026-03-28] [AI] AI Service — HTTP Sync Handler + Redis Worker
> Branch: `feat(ai)/ai-service-http-redis-worker`

### Implementado
- [x] Etapa 1: Planejamento — consultados docs/face/, ADR-005, lgpd-biometrics, redis-ai-queue, security-best-practices
- [x] Etapa 2: `POST /process-image` — pipeline RAM-only (base64 → RetinaFace → crop → ArcFace 512d → descarte); validações: 1 face, ≥50px, blur>100, centering 0.3–0.7, brightness 40–220, quality_score; erros estruturados; payload max 1MB; timeout 3s
- [x] Etapa 3: Redis worker `BLPOP ai:recognition:queue` — job desserializado via Pydantic; resultado publicado em `ai:recognition:result:{jobId}` com SETEX TTL 60s; credenciais 100% via env vars
- [x] Etapa 4: `GET /health` — retorna `{status, model, uptime_s}` sem expor detalhes de infra; Swagger desabilitado em produção (DEBUG=false)
- [x] Etapa 5: 18/18 testes pytest passando (mocks InsightFace + Redis + Worker); zero imagem persistida verificado por teste LGPD

### Arquivos criados em `apps/ai-service/`
- `main.py`, `config.py`, `requirements.txt`, `Dockerfile`, `.env.example`, `pytest.ini`, `.dockerignore`
- `schemas/http_schemas.py`, `schemas/job_schemas.py`
- `services/face_service.py` — FaceService RAM-only, thread pool executor
- `validators/frame_validator.py` — decode_frame + validate_quality
- `workers/redis_worker.py` — RedisWorker asyncio BLPOP consumer
- `tests/conftest.py`, `tests/test_health.py`, `tests/test_process_image.py`

### Notas técnicas
- `asyncio.run_in_executor` obrigatório para InsightFace (síncrono; não bloqueia event loop)
- Import de `insightface.app.FaceAnalysis` deferido dentro de `load_models()` para permitir mock em testes sem InsightFace instalado
- Filas: `ai:recognition:queue` / `ai:recognition:result:{jobId}` conforme decisão do sprint
- Bug de teste corrigido: `FaceServiceError` importada localmente nos testes que a usam como side_effect (evita split de identidade de classe após reload de módulo)
