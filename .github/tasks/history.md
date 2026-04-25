# History — TODOs Concluídos

> Diretório canônico de task management: `.github/tasks/`
> Registro append-only das entregas concluídas no Vultra.

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

---

## [2026-04-06] Parcialmente implementado (sem aprovação formal) — Sprint Reconhecimento Facial

> Descoberto via auditoria de código na sessão 84c54233.
> Os itens abaixo foram implementados incrementalmente sem o fluxo plan→aprovação→testes→code.
> Nenhuma subtask foi formalmente marcada `[x]` — a limpeza do todo.md foi feita por análise de código.

### API Core — Infraestrutura de Biometria (parcial)

- [x] `EnrollBiometricUseCase` — AI queue → quality gate (0.5 min) → persist embedding
- [x] `RevokeBiometricUseCase` — soft-delete `is_active = FALSE` + zero-fill `face_embedding`
- [x] `BiometricsRepository.enroll` — deativa perfil anterior antes de inserir novo
- [x] `BiometricsRepository.revoke` — `is_active = FALSE` + `face_embedding = NULL` (LGPD)
- [x] `BiometricsRepository.findBySimilarity` — pgvector `<=>` cosine, filtro orgId + modelVersion + isActive
- [x] `BiometricsRepository.touchLastMatched` — atualiza `last_matched_at` após match
- [x] `POST /v1/biometric/enroll` — rota funcional (prefix `/biometric`, não `/face`)
- [x] `DELETE /v1/biometric/:memberId` — rota funcional (param `memberId`, não `profileId`)
- [x] `AIJobQueue` Circuit Breaker Redis — CLOSED/OPEN/HALF_OPEN, 5 falhas, 30s cooldown
- [x] `IAIQueueAdapter` port — interface desacoplada para use cases
- [x] `GET /v1/health/ai-service` — expõe estado do Circuit Breaker

### Database — Colunas e índices já existentes desde migrações anteriores

- [x] `biometric_profiles.quality_score REAL` — migration 0005
- [x] `biometric_profiles.model_version TEXT` — migration 0005
- [x] `biometric_profiles.is_active BOOLEAN DEFAULT TRUE` — migration 0005
- [x] RLS em `biometric_profiles` com policy de isolamento por `organization_id` — migration 0005
- [x] Índice HNSW em `face_embedding` (vector_cosine_ops) — migration 0009

### Audit Log — Base de infraestrutura

- [x] Tabela `audit_logs` com trigger de imutabilidade (`trg_audit_logs_immutable`) — migration 0008
- [x] Schema Drizzle `schema/audit-logs.ts` — `auditLogs` pgTable com tipos corretos

---

## [2026-04-25] Execução 01 — [FIX] Merge Conflicts — AI Service Python + package.json corrompido
> Branch: `fix/facial-recognition-recovery`
> GitHub Issue: #3

### Corrigido
- [x] `apps/api-core/package.json` — removido JSON duplicado injetado dentro de `dependencies`; arquivo voltou a ser JSON válido
- [x] `apps/ai-service/config.py` — consolidado `Settings` + `get_settings()` sem conflict markers
- [x] `apps/ai-service/main.py` — consolidado bootstrap FastAPI, lifespan, middleware e rotas sem duplicações
- [x] `apps/ai-service/services/face_service.py` — removidas duplicações estruturais; `FaceServiceError` e `FaceService` reconstituídos
- [x] `apps/ai-service/validators/frame_validator.py` — removidas duplicações; `decode_frame()` e `validate_quality()` consolidados
- [x] `apps/ai-service/workers/redis_worker.py` — removidas duplicações; loop BLPOP e publicação de resultados restaurados
- [x] `apps/ai-service/**/__pycache__` e `*.pyc` removidos do tracking

### Verificação observada
- [x] Busca por `<<<<<<<|=======|>>>>>>>` no repositório → sem resultados
- [x] Parse JSON de `apps/api-core/package.json` → exit code 0
- [x] `python -m py_compile` no AI Service → exit code 0
- [x] Import da app principal do AI Service (`main.app`) → exit code 0
- [x] `cd apps/api-core && bun install` → exit code 0

---

## [2026-04-25] Execução 02 — [FIX] TypeScript Strict Errors + Bun Install
> Branch: `fix/facial-recognition-recovery`
> GitHub Issue: #9

### Resultado
- [x] `cd apps/api-core && bun install` → exit code 0
- [x] `cd apps/api-core && bun run typecheck` → exit code 0
- [x] Nenhuma correção adicional foi necessária nos arquivos do `api-core`

---

## [2026-04-25] Execução 03 — [DATA] Migration 0015 — Colunas adicionais em biometric_profiles
> Branch: `fix/facial-recognition-recovery`
> GitHub Issue: #7

### Estrutura de dados atualizada
- [x] `apps/api-core/src/infrastructure/database/migrations/0015_biometric_profiles_audit_columns.sql` criada
- [x] `apps/api-core/src/infrastructure/database/migrations/meta/_journal.json` atualizado com entry idx 14
- [x] `apps/api-core/src/infrastructure/database/schema/biometric-profiles.ts` atualizado com `deviceId`, `createdBy`, `deletedAt`, `deletedBy` e `faceEmbedding` nullable
- [x] `apps/api-core/src/infrastructure/database/schema/index.ts` atualizado para `membersRelations.biometricProfiles: many(biometricProfiles)`

### Contrato base do backend alinhado
- [x] `apps/api-core/src/infrastructure/auth.ts` — `advanced.database.generateId = 'uuid'` definido explicitamente
- [x] `apps/api-core/src/adapters/repositories/biometrics.repo.ts` — contrato final preparado para:
  - revoke por `profileId`
  - listagem por `organizationId` + `memberId?`
  - similaridade com filtro opcional `memberId`
- [x] `apps/api-core/src/core/use-cases/biometrics.use-cases.ts` — revoke ajustado para preencher `deleted_at` / `deleted_by` via repositório

### Verificação observada
- [x] `cd apps/api-core && bun run db:migrate` → exit code 0
- [x] `cd apps/api-core && bun run typecheck` → exit code 0

---

## [2026-04-25] Execução 04 — [FEAT] Testes — Fase 1 (Criar cenários TDD para Use Cases + Rotas /v1/face)
> Branch: `fix/facial-recognition-recovery`
> GitHub Issue: #8

### Arquivos criados
- [x] `apps/api-core/src/__tests__/use-cases/biometrics.use-cases.test.ts`
- [x] `apps/api-core/src/__tests__/routes/face.routes.test.ts`

### Cobertura criada
- [x] `EnrollBiometricUseCase` — sucesso, `NO_FACE`, qualidade `< 0.40`, CB aberto, org isolation
- [x] `VerifyFaceUseCase` — `MATCH`, `POSSÍVEL`, `SEM_MATCH`, CB aberto, sem perfis cadastrados, `memberId` fora do tenant → `404` antes do AI Service
- [x] `ListFacesUseCase` — lista vazia, filtro `memberId`, org isolation
- [x] `RevokeBiometricUseCase` — sucesso, perfil inexistente, org isolation
- [x] Rotas `/v1/face/*` — sucesso por endpoint, `422`, `413`, `401`, `403`, `404`, `429`, `503` com e sem `Retry-After`
- [x] Cutover legado `/v1/biometric/*` → `404`

### Gate de aprovação
- [x] `architect` → APROVADA
- [x] `specs-collector` → APROVADA
- [x] usuário → aprovação explícita para prosseguir

---

## [2026-04-25] Execução 05 — [FEAT] Use Cases — Implementar VerifyFaceUseCase + ListFacesUseCase
> Branch: `fix/facial-recognition-recovery`
> GitHub Issue: #4

### Implementado
- [x] `apps/api-core/src/core/use-cases/biometrics.use-cases.ts`
  - `VerifyFaceUseCase` implementado com thresholds `MATCH` / `POSSÍVEL` / `SEM_MATCH`
  - validação de `memberId` fora do tenant antes de acionar o AI Service
  - `touchLastMatched` somente em `MATCH`
  - `SEM_MATCH` retorna `confidence=0` e sem `memberId`
  - `ListFacesUseCase` implementado consumindo listagem sanitizada do repositório

### Ajustes auxiliares para liberar validação
- [x] correções de lint/typing mínimas em arquivos do `api-core` necessários para `bun run lint` voltar a passar

### Verificação observada
- [x] `cd apps/api-core && bun run lint` → exit code 0
- [x] `cd apps/api-core && bun run typecheck` → exit code 0
- [x] `cd apps/api-core && bun run format` → exit code 0
- [x] `cd apps/api-core && bun run build` → exit code 0
- [x] `cd apps/api-core && bun test src/__tests__/use-cases/biometrics.use-cases.test.ts` → exit code 0 (`17 pass / 0 fail`)

---

## [2026-04-25] Execução 06 — [FEAT] Rotas — Corrigir prefix + adicionar /v1/face/verify e /v1/face/list
> Branch: `fix/facial-recognition-recovery`
> GitHub Issue: #5

### Implementado
- [x] `apps/api-core/src/adapters/http/face.routes.ts` criado como superfície canônica
- [x] `POST /v1/face/enroll` ativado na nova superfície
- [x] `POST /v1/face/verify` implementado com `jobId` gerado na rota
- [x] `GET /v1/face/list` implementado com retorno sanitizado
- [x] `DELETE /v1/face/:profileId` implementado consumindo lookup por `(profileId, organizationId)`
- [x] legado `/v1/biometric/*` passou a responder `404`

### Autorização e limites
- [x] `apps/api-core/src/infrastructure/auth.ts` consolidado como fonte canônica de permissões biométricas
- [x] RBAC real aplicado via `derive` + `checkPermission`
- [x] rate limiting por usuário e organização aplicado com `429` + `Retry-After`
- [x] `AI_SERVICE_UNAVAILABLE` padronizado em `503` com e sem `Retry-After` conforme cooldown conhecido

### Verificação observada
- [x] `cd apps/api-core && bun run lint` → exit code 0
- [x] `cd apps/api-core && bun run typecheck` → exit code 0
- [x] `cd apps/api-core && bun run format` → exit code 0
- [x] `cd apps/api-core && bun run build` → exit code 0
- [x] `cd apps/api-core && bun test src/__tests__/routes/face.routes.test.ts` → exit code 0 (`30 pass / 0 fail`)

---

## [2026-04-25] Execução 07 — [FEAT] AuditLogRepository + Integração nos Use Cases
> Branch: `fix/facial-recognition-recovery`
> GitHub Issue: #6

### Implementado
- [x] `apps/api-core/src/adapters/repositories/audit-log.repository.ts` criado como repositório insert-only
- [x] `EnrollBiometricUseCase` auditando `BIOMETRIC_PROFILE_ENROLLED`
- [x] `VerifyFaceUseCase` auditando `BIOMETRIC_PROFILE_VERIFIED` em `MATCH`, `POSSÍVEL`, `SEM_MATCH` e `404 NOT_FOUND`
- [x] `RevokeBiometricUseCase` auditando `BIOMETRIC_PROFILE_REVOKED` em sucesso e `404 NOT_FOUND`
- [x] `face.routes.ts` passando `actorId`, `actorType='user'` e `ipAddress`
- [x] payload sanitizado sem `frameBase64` ou embedding

### Verificação observada
- [x] `cd apps/api-core && bun run lint` → exit code 0
- [x] `cd apps/api-core && bun run typecheck` → exit code 0
- [x] `cd apps/api-core && bun run format` → exit code 0
- [x] `cd apps/api-core && bun run build` → exit code 0
- [x] `cd apps/api-core && bun test src/__tests__/use-cases/biometrics.use-cases.test.ts src/__tests__/routes/face.routes.test.ts` → exit code 0 (`47 pass / 0 fail`)

---

## [2026-04-25] Execução 08 — [FEAT] Testes — Fase 2 (Fazer a suíte biométrica passar)
> Branch: `fix/facial-recognition-recovery`
> GitHub Issue: #8

### Resultado
- [x] Nenhuma correção adicional foi necessária para a suíte biométrica da sprint
- [x] Sem `skip` nos testes biométricos alvo
- [x] Isolamento entre tenants observável como `404`

### Verificação observada
- [x] `cd apps/api-core && bun run lint` → exit code 0
- [x] `cd apps/api-core && bun run typecheck` → exit code 0
- [x] `cd apps/api-core && bun run format` → exit code 0
- [x] `cd apps/api-core && bun run build` → exit code 0
- [x] `cd apps/api-core && bun test` → exit code 0 (`47 pass / 0 fail`)

---

## [2026-04-25] Execução 09 — [DOCS] Documentação — Face Recognition (contratos, fluxos, LGPD)
> Branch: `fix/facial-recognition-recovery`
> GitHub Issue: #10

### Documentação atualizada
- [x] `docs/backend/adrs/ADR-006-biometric-profiles-e-rate-limiting-biometria.md` criado
- [x] `docs/face/README.md` reescrito com contratos finais `/v1/face/*`, thresholds, erros publicados, Redis + Circuit Breaker e LGPD
- [x] `docs/database/arquitetura/schema.md` atualizado com a migration 0015 em `biometric_profiles`
- [x] `docs/backend/README.md` atualizado para referenciar o ADR-006
- [x] `docs/README.md` atualizado para indexar a documentação de face recognition

### Decisões refletidas
- [x] `biometric_profiles` consolidado como recurso canônico da biometria facial
- [x] `verify` documentado como `200` com `MATCH | POSSÍVEL | SEM_MATCH`
- [x] legado `/v1/biometric/*` documentado como `404`
- [x] revoke por `profileId` documentado
- [x] rate limiting biométrico por usuário e organização documentado
