# 🏗️ Schema — Tabelas e Relacionamentos

> **← [Voltar ao Database](../README.md)**

---

## Diagrama Entidade-Relacionamento

```
organizations
    │
    ├── members (usuários por tenant)
    │       │
    │       └── biometric_profiles (vector(512) por membro)
    │
    ├── devices (ESP32-CAM cadastrados)
    │
    ├── classes / departments
    │       │
    │       └── attendance_sessions
    │               │
    │               └── attendance_records
    │
    └── audit_logs (somente inserção — imutável)
```

---

## Tabela: `organizations`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | UUID PK | `uuid_generate_v4()` |
| `slug` | TEXT UNIQUE | Identificador URL-friendly do tenant |
| `name` | TEXT | Nome da instituição |
| `plan` | TEXT | `'trial'` \| `'pro'` \| `'enterprise'` |
| `settings` | JSONB | Configurações livres do tenant |
| `is_active` | BOOLEAN | Soft-disable de tenant |
| `created_at` / `updated_at` | TIMESTAMPTZ | Auditoria de tempo |

---

## Tabela: `members`

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | UUID PK | — |
| `organization_id` | UUID FK | → `organizations.id` — **filtro obrigatório** |
| `user_id` | UUID | → tabela de auth do Better Auth |
| `role` | TEXT | `'admin'` \| `'professor'` \| `'rh'` \| `'student'` |
| `external_code` | TEXT | Matrícula ou código de funcionário |
| `is_active` | BOOLEAN | Soft delete |

> **Índices:** `(organization_id)` e `(organization_id, role)` — obrigatórios para listagem.

---

## Tabela: `biometric_profiles` ⚠️ Sensível (LGPD Art. 11)

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | UUID PK | — |
| `organization_id` | UUID FK | Isolamento de tenant |
| `member_id` | UUID FK UNIQUE | Um perfil por membro |
| `face_embedding` | `vector(512)` | **Nunca armazenar imagem — somente vetor** |
| `model_version` | TEXT | Ex: `'ArcFace-v1'` — **sempre preencher** |
| `quality_score` | REAL | Score de qualidade do enroll (0–1) |
| `enrolled_at` | TIMESTAMPTZ | Data do cadastro biométrico |
| `last_matched_at` | TIMESTAMPTZ | Última vez que o rosto foi reconhecido |

> **Índice HNSW** em `face_embedding` com `vector_cosine_ops` — ver [manuais/indexacao.md](../manuais/indexacao.md).  
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

| Coluna | Tipo | Notas |
|--------|------|-------|
| `id` | UUID PK | — |
| `organization_id` | UUID FK | Isolamento de tenant |
| `session_id` | UUID FK | Sessão de chamada |
| `member_id` | UUID FK | Membro identificado |
| `confidence_score` | REAL | Similaridade cosseno (0–1) |
| `match_threshold` | REAL | Threshold usado no momento do match (default: 0.85) |
| `recognition_method` | TEXT | `'face'` \| `'manual'` |
| `sentiment_label` | TEXT nullable | `'happy'` \| `'neutral'` \| `'sad'` \| ... |
| `sentiment_score` | REAL nullable | Score do sentimento dominante (0–1) |
| `is_manual` | BOOLEAN | `TRUE` se inserido manualmente pelo professor |

> **Constraint UNIQUE:** `(session_id, member_id)` — impede duplicata na sessão (HTTP 409).

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
| `id` | BIGSERIAL PK | Sequencial para ordenação natural |
| `organization_id` | UUID | **Sem FK** — garante imutabilidade histórica |
| `actor_id` | UUID nullable | `NULL` para ações do sistema |
| `actor_type` | TEXT | `'user'` \| `'device'` \| `'system'` |
| `action` | TEXT | Ex: `'ATTENDANCE_RECORD_CREATED'` |
| `resource_type` | TEXT | Ex: `'attendance_records'` |
| `resource_id` | UUID nullable | ID do recurso afetado |
| `payload` | JSONB | Snapshot do estado anterior/posterior |
| `ip_address` | INET nullable | Origem da requisição |

> **Política:** `UPDATE` e `DELETE` nesta tabela são proibidos por política de aplicação. Futuramente: trigger no banco.

---

## Extensões PostgreSQL Necessárias

| Extensão | Finalidade |
|----------|------------|
| `uuid-ossp` | `uuid_generate_v4()` |
| `pgvector` | Tipo `vector(N)` e operadores `<=>`, `<->` |
| `pg_trgm` | Busca textual por similaridade (nomes, matrículas) |
| `btree_gin` | Índices GIN compostos em JSONB |
