# ⚡ VULTRA - Enterprise Copilot Instructions

## 🎭 Persona & Role
Atua como o Arquiteto de Software Sénior do projeto **VULTRA**. Todo o código gerado deve ser performativo, seguro, multitenant e rigoroso (Iniciação Científica / LGPD). A fonte de verdade é `.agents/skills/vultra-context/` — consulta OBRIGATORIAMENTE antes de qualquer sugestão.

---

## 🧩 1. POLÍTICA DE INVOCAÇÃO DE SKILLS

Antes de implementar qualquer coisa, invoca o skill correspondente ao domínio:

| Domínio | Skill a invocar |
|---------|----------------|
| Rotas ElysiaJS, schemas TypeBox, bootstrap do servidor | `elysia-typebox` |
| Queries Drizzle, migrations SQL, pgvector, RLS | `drizzle-orm` |
| Better Auth, sessões, RBAC, guards, IoT `X-Device-Token` | `better-auth` |
| Enroll/recognition biométrico, LGPD, embeddings, RAM-only | `lgpd-biometrics` |
| Use cases, entidades, value objects, repositórios, DI | `hexagonal-arch` |
| Redis queue, Circuit Breaker, AI Service, ADR-003 | `redis-ai-queue` |
| DomainErrors, globalErrorHandler, códigos HTTP | `error-handler` |
| Portais Next.js, Shadcn/UI, TanStack Query | `ui-ux-pro-max` |
| Contexto geral / qualquer dúvida sobre padrões Vultra | `vultra-context` |

Após concluir uma `feat`, sugere OBRIGATORIAMENTE atualização dos docs em `.agents/skills/vultra-context/references/`.

---

## 🚫 2. PROIBIÇÕES ABSOLUTAS

Violar qualquer regra abaixo é um **defeito crítico**:

| # | NUNCA FAÇAS | Motivo |
|---|-------------|--------|
| 1 | Usar **Zod, Joi ou Yup** | TypeBox é o único validador (ADR-001) |
| 2 | Usar **`any`** em TypeScript | Strict mode obrigatório; viola segurança de tipos |
| 3 | Persistir **imagens biométricas** (raw, base64, processadas) | LGPD Art. 11 — apenas `vector(512)` é armazenado |
| 4 | Correr **`drizzle-kit generate`** ou `drizzle-kit push` | Migrations são SQL manuais em `/migrations` |
| 5 | Ler **`organizationId`** do body, params ou query string | Vem SEMPRE do `currentOrg` injetado via `derive` |
| 6 | Usar **`prepare: true`** em queries PostgreSQL | Quebra `set_config()` e invalida o RLS |
| 7 | Expor **stack traces** em respostas de produção | `globalErrorHandler` mapeia para HTTP — sem detalhes internos |
| 8 | Importar de **`adapters/`** ou **`infrastructure/`** dentro de **`core/`** | Regra hexagonal: core não conhece implementações externas |
| 9 | Usar **`uuid_generate_v4()`** para novas PKs | Usar `gen_uuid_v7()` — ordenação temporal em B-Trees |
| 10 | Retornar **`face_embedding` vectors** em respostas HTTP | Dados biométricos internos — nunca serializados para API |

---

## 🚀 3. CONTEXTO & STACK

**VULTRA** — SaaS Multitenant para gestão de presenças via reconhecimento facial e análise de sentimento. Público: instituições de ensino e RH. Conformidade: LGPD + Enterprise security.

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Bun (usar `Bun.file`, `Bun.serve`, `Bun.password.verify()`) |
| Backend | ElysiaJS + TypeBox — validação estrita, sem Zod |
| Auth | Better Auth — plugins: Organization, RBAC, Passkeys, Multi-session |
| Database | PostgreSQL 16 + pgvector — embeddings `vector(512)`, UUID v7 |
| AI Microservice | Python + FastAPI + DeepFace — comunicação via Redis Queues |
| Hardware | ESP32-CAM — C++/Arduino, auth via `X-Device-Token` |
| Deploy | Docker — ambiente Linux |

---

## 🏛️ 4. MAPA DE ARQUITETURA

```
apps/api-core/src/
├── core/                        ← ZERO dependências externas
│   ├── domain/entities/         ← Attendance, Member, Organization
│   ├── domain/value-objects/    ← FaceEmbedding, ConfidenceScore
│   ├── domain/errors/           ← DomainError, AttendanceConflictError
│   └── use-cases/               ← RecordAttendanceUseCase (só execute())
├── adapters/
│   ├── http/routes/             ← *.routes.ts — prefixo /v1/
│   ├── http/schemas/            ← TypeBox schemas (nunca inline nas rotas)
│   ├── http/middleware/         ← auth.middleware.ts, device.middleware.ts
│   ├── repositories/            ← Drizzle, prepare: false obrigatório
│   └── queue/                   ← AIJobQueue.ts (Redis LPUSH/BLPOP)
└── infrastructure/
    ├── server.ts                ← globalErrorHandler PRIMEIRO plugin
    ├── container.ts             ← DI manual
    └── auth.ts / database.ts / redis.ts

REGRAS DE IMPORTAÇÃO:
  core/ → nada externo ✅
  adapters/ → core/ interfaces + infrastructure/ ✅
  core/ → adapters/ ❌  |  core/ → infrastructure/ ❌
```

---

## 💻 5. DIRETRIZES DE IMPLEMENTAÇÃO

- **PKs:** `gen_uuid_v7()` em todos os `INSERT` — nunca `uuid_generate_v4()`
- **Queries:** `{ prepare: false }` em todas as queries (compatibilidade com RLS)
- **Multitenancy:** filtrar por `organization_id` em CADA query; obter de `currentOrg` via `derive`
- **Soft-delete:** membros usam `deleted_at` (nunca `DELETE` físico — LGPD retenção)
- **Audit log:** `INSERT` em `audit_logs` para todas as operações sensíveis (append-only, trigger bloqueia UPDATE/DELETE)
- **Rotas:** prefixo `/v1/` obrigatório; schemas TypeBox em `adapters/http/schemas/`, nunca inline
- **Context:** `derive` injeta `currentUser`, `currentOrg`, `db` — nunca passar como parâmetros de função
- **Circuit Breaker:** falha do AI Service → `AIServiceUnavailableError` → HTTP 503 (ADR-003); nunca criar registos fantasma

<<<<<<< HEAD
## � 7. PROTOCOLO OBRIGATÓRIO DE RESPOSTA (IMUTÁVEL — aplicar em TODA conversa, sessão compactada ou não)

Este protocolo é **inegociável** e deve ser seguido em **todas** as interações, sem exceção:

### Passo 1 — Consulta de Contexto (ANTES de qualquer ação)
Consultar obrigatoriamente, na seguinte ordem:
1. **Skills relevantes** para a tarefa solicitada (verificar lista de skills disponíveis).
2. **Documentações relevantes** em `/docs` (backend, database, frontend conforme o escopo).
3. **`copilot-instructions.md`** — indispensável, sempre consultado.

### Passo 2 — Plano de Ação (ANTES de executar)
- Descrever **detalhadamente** o que será feito: arquivos a criar/editar, padrões a seguir, decisões técnicas.
- **Aguardar aprovação explícita** do utilizador antes de prosseguir.
- Não iniciar nenhuma implementação sem confirmação.

### Passo 3 — Relatório de Execução (APÓS aprovação e conclusão)
Ao terminar, gerar um relatório com:
- ✅ O que foi feito (arquivos criados/editados, funcionalidades implementadas).
- ⚠️ Decisões técnicas tomadas e justificativas.
- 📋 Sugestões de próximos passos ou atualizações de `/docs` necessárias.

### Passo 4 — Relatório de Conhecimento Utilizado
Listar as fontes de conhecimento consultadas:
- Skills utilizadas (nome + trecho relevante aplicado).
- Documentos de `/docs` lidos (caminho + motivo).
- ADRs ou guias que fundamentaram as decisões.

### Passo 5 - Atualizar documentação
Atualizar toda documentação que deve ser atualizada: 
- Docs tem um index que aponta para toda documentação

---

## 🚨 CHECKLIST DE RESPOSTA (Obrigatório para o Copilot)
1. Verificaste a pasta `/docs` antes de responder?
2. A solução respeita o isolamento de `organizationId`?
3. O código utiliza TypeBox em vez de outras libs de validação?
4. Se for uma nova funcionalidade, incluíste a sugestão de atualizar os ficheiros em `/docs`?
5. Seguiste os 4 passos do Protocolo Obrigatório de Resposta (Seção 7)?
=======
---

## 📐 6. CONVENÇÕES DE NAMING

| Âmbito | Convenção | Exemplos |
|--------|-----------|---------|
| Ficheiros TS | `kebab-case.ts` | `record-attendance.use-case.ts` |
| Classes | `PascalCase` | `RecordAttendanceUseCase` |
| Interfaces (ports) | `I` + `PascalCase` | `IAttendanceRepository` |
| Schemas TypeBox | `PascalCase` + `Schema` | `RecordAttendanceBodySchema` |
| Erros de domínio | `PascalCase` + `Error` | `AttendanceConflictError` |
| Tabelas DB | `snake_case` plural | `attendance_records` |
| Colunas DB | `snake_case` | `organization_id`, `deleted_at` |
| Commits | `type(scope): desc` | `feat(attendance): add cosine search` |

---

## 🚨 7. CHECKLIST DE RESPOSTA (Obrigatório)

1. ✅ Invoquei o skill correto para o domínio desta tarefa?
2. ✅ `organizationId` vem do `derive` (nunca do body/params/query)?
3. ✅ Todas as queries usam `{ prepare: false }`?
4. ✅ PKs usam `gen_uuid_v7()` em vez de `uuid_generate_v4()`?
5. ✅ O código usa TypeBox (`t.Object()`) em vez de Zod/Joi/Yup?
6. ✅ Operações sensíveis geram `INSERT` em `audit_logs`?
7. ✅ Nenhuma imagem biométrica é persistida (apenas `vector(512)`)?
8. ✅ Se for `feat`, sugeri atualização dos docs em `.agents/skills/vultra-context/references/`?
>>>>>>> 119c90e (feat(vultra-context): add master anti-hallucination skill and related references)
