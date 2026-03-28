# Backlog — Reconhecimento Facial (PoC → Produção)

> Sprint ativa desde: 2026-03-27
> Decisões confirmadas no plano (sessão dedc54a7):
> - Reutilizar tabela `biometric_profiles` (não criar `face_embeddings`)
> - Modo primário: Redis + Circuit Breaker desde o PoC; HTTP síncrono apenas atalho local
> - Thresholds: MATCH > 0.85 | POSSÍVEL 0.75–0.85 | SEM MATCH < 0.75
> - Qualidade: < 0.40 rejeita | 0.40–0.60 aviso | 0.60–0.75 média | > 0.75 alta
> - RBAC: admin→tudo | professor→enroll/verify/list/delete | rh→list/verify
> - Frame base64 máx 1 MB | timeout HTTP/Redis 3000 ms | TTL Redis 60 s | CB abre após 5 falhas
> - Rate limiting: user 5 RPS burst 10 bloqueio 60 s | org 20 RPS bloqueio 60 s

---

# Tarefa: [AI] AI Service — HTTP Sync Handler + Redis Worker

- [ ] Etapa 1: Planejamento — Consultar `docs/face/`, ADR-005, skill `lgpd-biometrics` e skill `redis-ai-queue`
- [ ] Etapa 2: Implementar endpoint `POST /process-image` (FastAPI)
  - Pipeline RAM-only: decode base64 → RetinaFace (detecção) → recorte/alinhamento → ArcFace (embedding 512d) → descartar imagem → retornar vetor
  - Validações: 1 face presente, rosto ≥ 50 px, blur > 100, centralização 0.3–0.7, brilho 40–220, quality_score calculado
  - Erros estruturados: `NO_FACE_DETECTED`, `MULTIPLE_FACES`, `LOW_QUALITY`, `FRAME_TOO_LARGE`
  - Resposta: `{ embedding: number[512], quality_score: float, processing_ms: int }`
  - Timeout interno: 3000 ms; resposta de erro com HTTP 422/503 conforme caso
- [ ] Etapa 3: Implementar worker Redis (BLPOP) consumindo fila `ai:recognition:queue`
  - Job payload: `{ jobId, frameBase64, organizationId, deviceId? }`
  - Result payload: `{ jobId, embedding?, quality_score?, processing_ms?, error? }`
  - Publicar resultado em `ai:recognition:result:{jobId}` com TTL 60 s
- [ ] Etapa 4: Endpoint `GET /health` — retorna `{ status: "ok"|"degraded", model: string, uptime_s: int }`
- [ ] Etapa 5: Testes smoke — handler `/health` + `/process-image` com mocks InsightFace; garantir zero persistência de imagem; `pytest` passa sem erros

## Revisão/Post-Mortem
- Sentimento (DeepFace) fica para sprint futura — não bloquear pipeline de reconhecimento

---

# Tarefa: [FEAT] API Core — Rotas /v1/face (enroll/verify/list/delete)

- [ ] Etapa 1: Planejamento — Consultar schema `biometric_profiles` (Drizzle), skills `elysia-typebox`, `hexagonal-arch`, `error-handler`, `redis-ai-queue`, `lgpd-biometrics`
- [ ] Etapa 2: Implementação — Use Cases (core/use-cases/)
  - `EnrollFaceUseCase`: chamar AI Service via fila Redis → receber embedding → persistir em `biometric_profiles` com `quality_score`, `model_version`, `is_active=true`; criar audit log ENROLL
  - `VerifyFaceUseCase`: chamar AI Service → busca vetorial `<=>` em `biometric_profiles` filtrada por `organizationId` → aplicar thresholds → retornar resultado MATCH/POSSÍVEL/SEM_MATCH; audit log VERIFY
  - `ListFacesUseCase`: listar perfis ativos por `organizationId` + `memberId` opcional; sem expor embedding
  - `DeleteFaceUseCase`: soft-delete (`is_active=false`) + zero-fill embedding (LGPD revogação); audit log DELETE
  - Todas as queries filtrando `organizationId` — violação = bug crítico
- [ ] Etapa 3: Implementação — Repositório (`adapters/repositories/biometric-profile.repository.ts`)
  - `insert`, `findByOrgAndMember`, `vectorSearch(embedding, orgId, limit, threshold)`, `softDelete`
  - Circuit Breaker para chamadas ao AI Service (`adapters/queue/ai-queue.adapter.ts`): 5 falhas → OPEN; timeout 3 s
- [ ] Etapa 4: Implementação — Rotas (`adapters/http/face.routes.ts`)
  - `POST /v1/face/enroll` — body: `{ memberId, frameBase64 }`, TypeBox schema, roles: admin/professor
  - `POST /v1/face/verify` — body: `{ frameBase64, memberId? }`, roles: admin/professor/rh
  - `GET /v1/face/list` — query: `{ memberId? }`, roles: admin/professor/rh
  - `DELETE /v1/face/:profileId` — roles: admin/professor
  - Rate limiting por usuário (5 RPS, burst 10) e por organização (20 RPS)
  - Schemas TypeBox obrigatórios em todos; RBAC via `derive` Better Auth
- [ ] Etapa 5: Validação — `bun run typecheck` zero erros + `bun test` passa

## Revisão/Post-Mortem
- Rota X-Device-Token (ESP32) fica para fase IoT — não implementar agora

---

# Tarefa: [FEAT] Database — Migration biometric_profiles (ajuste de schema)

- [ ] Etapa 1: Planejamento — Inspecionar migration atual da `biometric_profiles`; verificar colunas faltantes vs plano
- [ ] Etapa 2: Migration SQL manual (`0015_biometric_profiles_enhancements.sql`)
  - Adicionar colunas se ausentes: `quality_score FLOAT`, `model_version VARCHAR(50)`, `is_active BOOLEAN DEFAULT true`, `device_id UUID NULL`
  - Adicionar audit: `created_by UUID`, `deleted_at TIMESTAMPTZ NULL`, `deleted_by UUID NULL`
  - Índice HNSW no pgvector para busca eficiente: `CREATE INDEX ... USING hnsw (embedding vector_cosine_ops)`
  - Atualizar `meta/_journal.json` com entry idx 14
- [ ] Etapa 3: Atualizar schema Drizzle (`schema/biometric-profiles.ts`) refletindo novas colunas
- [ ] Etapa 4: Atualizar `schema/index.ts` se necessário
- [ ] Etapa 5: Executar `bun run db:migrate` e confirmar aplicação sem erros

## Revisão/Post-Mortem
- Confirmar se tabela `audit_logs` já existe ou precisa ser criada nesta migration

---

# Tarefa: [FEAT] Audit Log — Tabela e Repositório de Eventos Biométricos

- [ ] Etapa 1: Planejamento — Verificar se `audit_logs` existe no schema atual; consultar skill `lgpd-biometrics`
- [ ] Etapa 2: Migration SQL manual (`0016_create_audit_logs.sql`) se tabela não existir
  - Colunas: `id UUID PK`, `organization_id UUID`, `event_type ENUM(ENROLL,VERIFY,DELETE)`, `user_id UUID`, `member_id UUID NULL`, `device_id UUID NULL`, `match_threshold FLOAT`, `similarity_score FLOAT NULL`, `quality_score FLOAT NULL`, `result VARCHAR(20)`, `error_code VARCHAR(50) NULL`, `created_at TIMESTAMPTZ`
  - Sem soft-delete: audit log é imutável
- [ ] Etapa 3: Schema Drizzle + repositório `AuditLogRepository` (insert only, sem update/delete)
- [ ] Etapa 4: Integrar chamadas nos use cases (EnrollFace, VerifyFace, DeleteFace)
- [ ] Etapa 5: `bun run db:migrate` + `bun run typecheck` zero erros

## Revisão/Post-Mortem
- N/A

---

# Tarefa: [FEAT] Testes — Unitários (Use Cases) + Integração (Rotas /v1/face)

- [ ] Etapa 1: Planejamento — Mapear cenários por use case e por rota; definir mocks de repositório e AI adapter
- [ ] Etapa 2: Testes unitários dos use cases (`__tests__/use-cases/`)
  - `EnrollFaceUseCase`: sucesso, frame inválido (NO_FACE), qualidade baixa, circuito aberto, org isolation
  - `VerifyFaceUseCase`: MATCH, POSSÍVEL, SEM_MATCH, circuito aberto, sem perfis cadastrados
  - `ListFacesUseCase`: lista vazia, lista com filtro memberId, org isolation
  - `DeleteFaceUseCase`: sucesso, perfil inexistente, org isolation
- [ ] Etapa 3: Testes de integração das rotas (`__tests__/routes/face.routes.test.ts`)
  - Sucesso em cada endpoint; input inválido (TypeBox); sem token; role errada; org isolation (outro orgId não vê dados)
- [ ] Etapa 4: Executar `bun test` — todos os testes passando
- [ ] Etapa 5: Cobertura mínima dos caminhos críticos confirmada; nenhum teste ignorado

## Revisão/Post-Mortem
- N/A

---

# Tarefa: [DOCS] Documentação — Face Recognition (contratos, fluxos, LGPD)

- [ ] Etapa 1: Atualizar `docs/face/README.md` — contratos finais (schemas TypeBox, respostas, erros), fluxo PoC vs produção, thresholds, pipeline RAM-only
- [ ] Etapa 2: Registrar ADR-006 se houver nova decisão arquitetural (ex.: reutilização de `biometric_profiles`)
- [ ] Etapa 3: Atualizar `docs/database/arquitetura/schema.md` com novas colunas
- [ ] Etapa 4: Atualizar `docs/backend/README.md` (tabela de ADRs se ADR-006 criado)
- [ ] Etapa 5: Atualizar index de `/docs` se necessário

## Revisão/Post-Mortem
- N/A
