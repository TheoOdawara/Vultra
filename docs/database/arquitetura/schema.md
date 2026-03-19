# 🏗️ Schema — Tabelas e Relacionamentos

> **← [Voltar ao Database](../README.md)**
> **Última revisão:** Março 2026 — schema completo (migrations 0001–0014, incluindo tabelas Better Auth)

---

## Diagrama Entidade-Relacionamento

```
organizations  (sem RLS — gerida pelo super-admin)
    │
    ├── members  (soft-delete via deleted_at)
    │       │
    │       └── biometric_profiles  (vector(512) — LGPD Art. 11)
    │               ↳ is_active: FALSE em migrações de modelo ou revogação
    │               ↳ Índice HNSW em face_embedding (migration 0009)
    │
    ├── devices  (ESP32-CAM — auth via X-Device-Token / api_key_hash)
    │
    └── attendance_sessions  (aberta por device; 1 sessão open por device)
            │
            └── attendance_records  (tabela simples — particionamento removido na migration 0010)

audit_logs  (BIGSERIAL PK — sem FK em organization_id — trigger bloqueia UPDATE/DELETE)

— — — Better Auth (prefixo auth_) — —
auth_users → auth_sessions, auth_accounts, auth_verifications
auth_organizations → auth_members, auth_invitations
auth_users → auth_passkeys
```

---

## Tabela: `organizations`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | UUID PK | `gen_uuid_v7()` — UUID v7 para ordenação temporal nos índices |
| `slug` | TEXT UNIQUE | Identificador URL-friendly do tenant |
| `name` | TEXT | Nome da instituição |
| `plan` | TEXT CHECK | `'trial'` \| `'pro'` \| `'enterprise'` |
| `settings` | JSONB | Configurações livres do tenant (threshold, integrações, limites) |
| `is_active` | BOOLEAN | `FALSE` = tenant desativado pela plataforma (acesso bloqueado) |
| `created_at` / `updated_at` | TIMESTAMPTZ | Trigger `set_updated_at()` atualiza `updated_at` automaticamente |

---

## Tabela: `members`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | UUID PK | `gen_uuid_v7()` |
| `organization_id` | UUID FK | → `organizations.id` — **filtro obrigatório** |
| `user_id` | TEXT nullable | → `auth_users.id` (FK concretizada na migration 0014, ON DELETE SET NULL) |
| `full_name` | TEXT | Nome completo do membro |
| `email` | TEXT nullable | — |
| `role` | TEXT CHECK | `'admin'` \| `'professor'` \| `'rh'` \| `'student'` |
| `external_code` | TEXT nullable | Matrícula ou código de funcionário |
| `is_active` | BOOLEAN | — |
| `deleted_at` | TIMESTAMPTZ nullable | **Soft-delete** — `NULL` = ativo. Preenchido = desativado (LGPD: retenção controlada) |
| `created_at` / `updated_at` | TIMESTAMPTZ | — |

> **Índices:** `(organization_id)`, `(organization_id, role)`, `(organization_id, is_active) WHERE deleted_at IS NULL` e índice trigrama GIN em `full_name` para autocomplete.
> **UNIQUE parcial:** `(organization_id, external_code) WHERE external_code IS NOT NULL AND deleted_at IS NULL`.

---

## Tabela: `biometric_profiles` ⚠️ Sensível (LGPD Art. 11)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | UUID PK | `gen_uuid_v7()` |
| `organization_id` | UUID FK | Isolamento de tenant |
| `member_id` | UUID FK | — |
| `face_embedding` | `vector(512)` | **Nunca armazenar imagem — somente vetor** (LGPD Art. 11) |
| `model_version` | TEXT | Ex: `'ArcFace-v1'` — **sempre preencher; filtrar em queries de reconhecimento** |
| `quality_score` | REAL CHECK | Score de qualidade do enroll `[0, 1]`. Mínimo recomendado: `0.7`. Rejeitar `< 0.5` |
| `is_active` | BOOLEAN | `FALSE` = desativado por migração de modelo ou revogação LGPD |
| `enrolled_at` | TIMESTAMPTZ | Data do cadastro biométrico |
| `last_matched_at` | TIMESTAMPTZ nullable | Última vez que o rosto foi reconhecido |

> **Índice HNSW** em `face_embedding` com `vector_cosine_ops` — migration `0009`, ver [manuais/indexacao.md](../manuais/indexacao.md).  
> **UNIQUE parcial:** `(member_id, model_version) WHERE is_active = TRUE` — garante um perfil ativo por (membro, modelo).  
> Para risco de migração de `model_version`, ver [arquitetura/versionamento-embeddings.md](./versionamento-embeddings.md).

---

## Tabela: `attendance_sessions`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | UUID PK | — |
| `organization_id` | UUID FK | Isolamento de tenant |
| `class_id` | UUID nullable | `NULL` para check-in corporativo |
| `device_id` | UUID FK | ESP32-CAM responsável pela sessão |
| `professor_id` | UUID FK nullable | Vínculo com professor (contexto educacional) |
| `started_at` | TIMESTAMPTZ | Início da chamada |
| `ended_at` | TIMESTAMPTZ nullable | Encerramento da sessão |
| `status` | TEXT | `'open'` \| `'closed'` \| `'cancelled'` |

---

## Tabela: `attendance_records`

> **Nota (migration 0010):** o particionamento trimestral foi removido por ser over-engineering para a fase atual.
> A tabela simples suporta os volumes esperados e elimina o overhead de criação manual de partições.

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | UUID PK | `gen_uuid_v7()` |
| `organization_id` | UUID | Isolamento de tenant |
| `session_id` | UUID FK | Sessão de chamada |
| `member_id` | UUID FK | Membro identificado |
| `recorded_at` | TIMESTAMPTZ | Data/hora do registo |
| `confidence_score` | REAL CHECK | Similaridade cosseno `[0, 1]` |
| `match_threshold` | REAL CHECK | Snapshot do threshold vigente (default: `0.85`) — auditoria de falsos positivos |
| `recognition_method` | TEXT CHECK | `'face'` \| `'manual'` |
| `sentiment_label` | TEXT nullable | `'happy'` \| `'neutral'` \| `'sad'` \| `'angry'` \| `'surprise'` \| `'fear'` \| `'disgust'` |
| `sentiment_score` | REAL CHECK nullable | Score do sentimento dominante `[0, 1]` |
| `is_manual` | BOOLEAN | `TRUE` se inserido manualmente pelo professor |

> **UNIQUE:** `(session_id, member_id)` — impede duplicata na sessão (retorna HTTP 409).

---

## Tabela: `devices`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | UUID PK | — |
| `organization_id` | UUID FK | Isolamento de tenant |
| `api_key_hash` | TEXT UNIQUE | Hash bcrypt do `X-Device-Token`. Nunca armazenar plaintext |
| `label` | TEXT | Ex: `'CAM-SALA-101'` |
| `location` | TEXT nullable | Descrição do local físico |
| `firmware_version` | TEXT nullable | Versão do firmware ESP32 |
| `last_seen_at` | TIMESTAMPTZ nullable | Último heartbeat recebido |
| `is_active` | BOOLEAN | Soft disable |

---

## Tabela: `audit_logs` (somente inserção)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | BIGSERIAL PK | Sequencial — ordenação natural sem overhead de timestamp sort |
| `organization_id` | UUID | **Sem FK intencional** — preserva histórico mesmo após exclusão do tenant |
| `actor_id` | UUID nullable | `NULL` para ações automáticas do sistema (cron, webhook, AI service) |
| `actor_type` | TEXT CHECK | `'user'` \| `'device'` \| `'system'` |
| `action` | TEXT | Convenção: `ENTIDADE_VERBO_PASSADO`. Ex: `ATTENDANCE_RECORD_CREATED`, `MEMBER_DELETED` |
| `resource_type` | TEXT | Ex: `'attendance_records'`, `'biometric_profiles'` |
| `resource_id` | UUID nullable | ID do recurso afetado |
| `payload` | JSONB | Snapshot do estado anterior e/ou posterior do recurso |
| `ip_address` | INET nullable | Origem da requisição (IPv4 ou IPv6) |

> **Imutabilidade garantida no banco:** trigger `trg_audit_logs_immutable` bloqueia `UPDATE` e `DELETE` com exceção em tempo de execução (não apenas política de aplicação).

---

## Extensões PostgreSQL Necessárias

| Extensão | Finalidade |
|----------|------------|
| `uuid-ossp` | Compatibilidade legada (`uuid_generate_v4()`). PK usa `gen_uuid_v7()` nativo |
| `vector` (pgvector) | Tipo `vector(N)` e operadores `<=>`, `<->`. Habilitado como `CREATE EXTENSION vector` |
| `pg_trgm` | Busca trigrama para autocomplete de nomes e matrículas |
| `btree_gin` | Índices GIN compostos em JSONB (settings, payload de audit_logs) |

> Todas as extensões são habilitadas na migration `0001_init_extensions_uuid_v7.sql`.

---

## Funções Globais

| Função | Tipo | Finalidade |
|--------|------|------------|
| `gen_uuid_v7()` | PL/pgSQL | Gera UUID v7 (RFC 9562) — 48-bit timestamp ms no prefixo para ordenação temporal em B-Trees |
| `set_updated_at()` | Trigger function | Atualiza `updated_at = NOW()` automaticamente via trigger `BEFORE UPDATE` |

---

## Tabelas Better Auth (prefixo `auth_`)

> Criadas nas migrations **0011–0013**. Usam IDs `TEXT` (UUID v7 gerado em JavaScript via `generateId` em `auth.ts`).
> **Sem RLS** — o Better Auth gerencia acesso internamente. Sem FK em tabelas de domínio aqui.
> ⚠️ `auth_organizations` ≠ `organizations` de domínio — são tabelas distintas. A sincronização entre elas é responsabilidade do UseCase de provisioning.

| Tabela | Plugin | Propósito |
|--------|--------|-----------|
| `auth_users` | core | Utilizadores autenticados |
| `auth_sessions` | core | Sessões ativas (multiSession: máx. 3) |
| `auth_accounts` | core | Credenciais por provider (email/pass, passkey) |
| `auth_verifications` | core | Tokens temporários (verificação e-mail, reset senha) |
| `auth_organizations` | organization | Organizações no contexto de auth |
| `auth_members` | organization | Membership de utilizadores em auth_organizations |
| `auth_invitations` | organization | Convites de ingresso |
| `auth_passkeys` | passkey | Credenciais WebAuthn/FIDO2 |

> **FK `members.user_id`:** migration `0014` concretiza a FK lógica existente desde `0003`.
> Altera `user_id` de `UUID` para `TEXT` (alinhamento com `auth_users.id`) com `ON DELETE SET NULL`.

