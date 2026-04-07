# Backlog — Reconhecimento Facial (Sprint Ativa)

> Sprint ativa desde: 2026-03-27
> Última auditoria: 2026-04-06 (sessão 84c54233)
> Decisões confirmadas no plano (sessão dedc54a7):
> - Reutilizar tabela `biometric_profiles` (não criar `face_embeddings`)
> - Modo primário: Redis + Circuit Breaker; HTTP síncrono apenas atalho local
> - Thresholds: MATCH > 0.85 | POSSÍVEL 0.75–0.85 | SEM MATCH < 0.75
> - Qualidade: < 0.40 rejeita | 0.40–0.60 aviso | 0.60–0.75 média | > 0.75 alta
> - RBAC: admin→tudo | professor→enroll/verify/list/delete | rh→list/verify
> - Frame base64 máx 1 MB | timeout HTTP/Redis 3000 ms | TTL Redis 60 s | CB abre após 5 falhas
> - Rate limiting: user 5 RPS burst 10 bloqueio 60 s | org 20 RPS bloqueio 60 s
> - Segurança (OWASP/LGPD): Proteção contra injeção, headers de segurança, logs sem PII, isolamento estrito por tenant.

---

# Tarefa: [FEAT] Use Cases — VerifyFace + ListFaces

## Specs
- Escopo: dois use cases ausentes que completam o CRUD biométrico
- Contratos:
  - `VerifyFaceUseCase.execute({ jobId, frameBase64, memberId?, organizationId })` → `{ result: 'MATCH'|'POSSÍVEL'|'SEM_MATCH', memberId?, confidence, processingMs }`
  - `ListFacesUseCase.execute({ organizationId, memberId? })` → `BiometricProfile[]` sem expor `face_embedding`
- Critérios de aceite: thresholds conforme ADR, todos os caminhos com org isolation, `ListFacesUseCase` nunca retorna o vetor

## Plano
- [ ] Etapa 1: Implementar `VerifyFaceUseCase` em `core/use-cases/biometrics.use-cases.ts`
  - AI queue → `findBySimilarity` → aplicar thresholds (MATCH/POSSÍVEL/SEM_MATCH) → `touchLastMatched` se MATCH → retornar resultado
  - `LowConfidenceMatchError` quando POSSÍVEL; `FaceNotRecognizedError` quando SEM_MATCH
- [ ] Etapa 2: Implementar `ListFacesUseCase` em `core/use-cases/biometrics.use-cases.ts`
  - Listar perfis ativos por `organizationId` + `memberId?` — sem expor `face_embedding`
- [ ] Etapa 3: Adicionar `BiometricsRepository.findByOrgAndMember(orgId, memberId?)` em `adapters/repositories/biometrics.repo.ts`
  - Retornar `{ id, memberId, qualityScore, modelVersion, enrolledAt, lastMatchedAt }[]` — sem embedding
- [ ] Etapa 4: `bun run typecheck` zero erros

## Post-Mortem
- N/A

---

# Tarefa: [FEAT] Rotas — Corrigir prefix + adicionar /v1/face/verify e /v1/face/list

## Specs
- Escopo: alinhar rotas existentes ao contrato planejado e adicionar as duas faltantes
- Contratos:
  - `POST /v1/face/enroll` (renomear de `/biometric/enroll`)
  - `POST /v1/face/verify` — body: `{ frameBase64, memberId? }`, roles: admin/professor/rh
  - `GET /v1/face/list` — query: `{ memberId? }`, roles: admin/professor/rh
  - `DELETE /v1/face/:profileId` — param `profileId` (renomear de `memberId`), roles: admin/professor
- Critérios de aceite: prefix `/face` em todas; RBAC real via `derive`; TypeBox strict; schemas sem `additionalProperties`

## Plano
- [ ] Etapa 1: Renomear `adapters/http/biometric.routes.ts` → `face.routes.ts`; alterar prefix para `/face`; atualizar import em `server.ts`
- [ ] Etapa 2: Implementar RBAC real nas rotas (substituir comentário "simple guard" por `derive` com `checkPermission`)
- [ ] Etapa 3: Adicionar `POST /v1/face/verify` — TypeBox body, roles admin/professor/rh, delegar a `VerifyFaceUseCase`
- [ ] Etapa 4: Adicionar `GET /v1/face/list` — TypeBox query, roles admin/professor/rh, delegar a `ListFacesUseCase`
- [ ] Etapa 5: Corrigir param `DELETE /v1/face/:profileId` (era `:memberId` — revogar por profileId ou memberId? — decidir e documentar)
- [ ] Etapa 6: Configurar rate limiting (5 RPS/user, burst 10; 20 RPS/org) com plugin Elysia
- [ ] Etapa 7: `bun run typecheck` zero erros

## Post-Mortem
- Decidir se `DELETE` revoga por `profileId` ou `memberId` (atualmente é por `memberId`)

---

# Tarefa: [FEAT] AuditLogRepository + Integração nos Use Cases

## Specs
- Escopo: repositório de audit log (insert-only) + chamadas em todos os use cases biométricos
- Contratos:
  - `AuditLogRepository.insert({ organizationId, actorId, actorType, action, resourceType, resourceId, payload, ipAddress? })` — sem update/delete
  - Ações a registrar: `BIOMETRIC_PROFILE_ENROLLED`, `BIOMETRIC_PROFILE_VERIFIED`, `BIOMETRIC_PROFILE_REVOKED`
  - `payload` NUNCA deve conter `frameBase64` nem vetor embedding (LGPD)
- Critérios de aceite: toda chamada de enroll/verify/revoke gera um audit log; payload sem dados sensíveis

## Plano
- [ ] Etapa 1: Criar `adapters/repositories/audit-log.repository.ts` — método `insert` only, usando schema `auditLogs`
- [ ] Etapa 2: Injetar `AuditLogRepository` no `EnrollBiometricUseCase` — registrar `BIOMETRIC_PROFILE_ENROLLED` com `quality_score`, `model_version`, `member_id` no payload
- [ ] Etapa 3: Injetar no `VerifyFaceUseCase` — registrar `BIOMETRIC_PROFILE_VERIFIED` com `result`, `confidence`, `member_id` no payload
- [ ] Etapa 4: Injetar no `RevokeBiometricUseCase` — registrar `BIOMETRIC_PROFILE_REVOKED` com `member_id` no payload
- [ ] Etapa 5: Passar `ipAddress` da camada de rota para os use cases (disponível no contexto Elysia via `request.headers`)
- [ ] Etapa 6: `bun run typecheck` zero erros

## Post-Mortem
- N/A

---

# Tarefa: [FEAT] Migration 0015 — Colunas adicionais em biometric_profiles

## Specs
- Escopo: adicionar colunas de auditoria de deleção e device tracking que o plano original exige
- Contratos: colunas `device_id UUID NULL`, `created_by UUID NULL`, `deleted_at TIMESTAMPTZ NULL`, `deleted_by UUID NULL`
- Critérios de aceite: migration aplica sem erros; schema Drizzle reflete as novas colunas

## Plano
- [ ] Etapa 1: Criar `migrations/0015_biometric_profiles_audit_columns.sql`
  - `ALTER TABLE biometric_profiles ADD COLUMN IF NOT EXISTS device_id UUID NULL`
  - `ALTER TABLE biometric_profiles ADD COLUMN IF NOT EXISTS created_by UUID NULL`
  - `ALTER TABLE biometric_profiles ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL`
  - `ALTER TABLE biometric_profiles ADD COLUMN IF NOT EXISTS deleted_by UUID NULL`
  - `COMMENT ON COLUMN` em cada nova coluna
  - Atualizar `meta/_journal.json` com entry idx 14
- [ ] Etapa 2: Atualizar `schema/biometric-profiles.ts` com as 4 novas colunas
- [ ] Etapa 3: Atualizar `RevokeBiometricUseCase` para preencher `deleted_at` e `deleted_by` ao revogar
- [ ] Etapa 4: `bun run db:migrate` — confirmar aplicação sem erros
- [ ] Etapa 5: `bun run typecheck` zero erros

## Post-Mortem
- N/A

---

# Tarefa: [FEAT] Testes — Unitários (Use Cases) + Integração (Rotas /v1/face)

## Specs
- Escopo: cobertura completa dos 4 use cases biométricos e das 4 rotas `/v1/face`
- Runner: `bun test` — sem Jest ou Vitest
- Localização: `apps/api-core/src/__tests__/`
- Critérios de aceite: `bun test` passa sem erros; org isolation coberto em TODOS os casos

## Plano
- [ ] Etapa 1: Criar estrutura `apps/api-core/src/__tests__/use-cases/` e `__tests__/routes/`
- [ ] Etapa 2: Testes unitários — `__tests__/use-cases/biometrics.use-cases.test.ts`
  - `EnrollBiometricUseCase`: sucesso, frame sem face (NO_FACE), qualidade baixa (<0.5), CB aberto, org isolation
  - `VerifyFaceUseCase`: MATCH (>0.85), POSSÍVEL (0.75–0.85), SEM_MATCH (<0.75), CB aberto, sem perfis cadastrados
  - `ListFacesUseCase`: lista vazia, lista com filtro memberId, org isolation (orgB não vê dados de orgA)
  - `RevokeBiometricUseCase`: sucesso, perfil inexistente, org isolation
- [ ] Etapa 3: Testes de integração — `__tests__/routes/face.routes.test.ts`
  - Sucesso em cada endpoint (200/201)
  - Input inválido/malicioso bloqueado pelo TypeBox (400/422)
  - Payload > 1MB rejeitado (413)
  - Sem token → 401
  - Role errada → 403
  - Org isolation → outro orgId não vê dados (404 ou 403)
  - Rate limiting → burst acima de 10 req → 429
- [ ] Etapa 4: `bun test` — todos passando, nenhum `skip`
- [ ] Etapa 5: Cobertura dos caminhos críticos confirmada

## Post-Mortem
- N/A

---

# Tarefa: [FIX] TypeScript Strict Errors + Bun Install

## Specs
- Escopo: zerar erros de TypeScript e garantir que o projeto compila limpo
- Contexto: pendente desde TODO.md raiz (handler params `any`, exactOptionalPropertyTypes)
- Critérios de aceite: `bun run typecheck` zero erros; `bun install` sem warnings críticos

## Plano
- [ ] Etapa 1: `cd apps/api-core && bun install`
- [ ] Etapa 2: `bun run typecheck` — listar todos os erros atuais
- [ ] Etapa 3: Corrigir handler params `any` (Elysia context) nos arquivos de rota
- [ ] Etapa 4: Corrigir `exactOptionalPropertyTypes` issues
- [ ] Etapa 5: `cd apps/api-core && bun biome check src --write` (lint)
- [ ] Etapa 6: `bun run typecheck` → zero erros confirmado

## Post-Mortem
- N/A

---

# Tarefa: [DOCS] Documentação — Face Recognition (contratos, fluxos, LGPD)

## Specs
- Escopo: atualizar docs para refletir o estado real da implementação
- Critérios de aceite: `docs/face/README.md` com contratos reais; ADR-006 registrado se necessário

## Plano
- [ ] Etapa 1: Reescrever `docs/face/README.md` — contratos finais TypeBox, respostas, erros, thresholds, pipeline Redis+CB, seção "Segurança e Conformidade LGPD"
- [ ] Etapa 2: Registrar ADR-006 sobre decisão de reutilização de `biometric_profiles` e estratégia de Rate Limiting
- [ ] Etapa 3: Atualizar `docs/database/arquitetura/schema.md` com colunas da migration 0015
- [ ] Etapa 4: Atualizar tabela de ADRs em `docs/backend/README.md` (ADR-006)
- [ ] Etapa 5: Verificar e atualizar index `docs/README.md` se necessário

## Post-Mortem
- N/A
