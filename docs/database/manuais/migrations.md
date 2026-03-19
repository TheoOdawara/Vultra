# 🔄 Política de Migrations

> **← [Voltar ao Database](../README.md)**

---

## Convenção de Nomenclatura

```
migrations/
├── 0001_init_extensions_uuid_v7.sql
├── 0002_create_organizations.sql
├── 0003_create_members.sql
├── 0004_create_devices.sql
├── 0005_create_biometric_profiles.sql
├── 0006_create_attendance_sessions.sql
├── 0007_create_attendance_records.sql
├── 0008_create_audit_logs.sql
├── 0009_create_hnsw_index.sql
├── 0010_simplify_attendance_records.sql
├── 0011_create_auth_core_tables.sql
├── 0012_create_auth_organization_tables.sql
├── 0013_create_auth_passkey_tables.sql
└── 0014_add_members_user_fk.sql
```

- Numeração **sequencial com 4 dígitos** (`0001`, `0002`, ...) — suporta até 9999 migrations sem renomear arquivos existentes
- Nome descritivo em `snake_case`
- Nunca reutilizar números — gaps são proibidos

---

## Regras

| Regra | Detalhes |
|-------|----------|
| **Append-only** | Proibido alterar ou deletar arquivo já executado em produção |
| **UP + DOWN** | Toda migration deve conter `-- UP` (aplicar) e `-- DOWN` (reverter) |
| **Transações** | DDL dentro de `BEGIN` / `COMMIT` — migration falha nunca deixa estado parcial |
| **Autocontida** | Não pode depender de estado não criado por ela ou por migrations anteriores |
| **Ferramenta** | `drizzle-kit migrate` para execução das migrations SQL manuais (ver seção abaixo) |

---

## Migration Inicial (`0001_init_extensions_uuid_v7.sql`)

Sempre deve ser executada primeiro. Habilita extensões e cria funções globais:

```sql
-- UP
BEGIN;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";    -- pgvector: CREATE EXTENSION vector
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";

CREATE OR REPLACE FUNCTION gen_uuid_v7() RETURNS UUID ...;  -- UUID v7 (RFC 9562)
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER ...;
COMMIT;

-- DOWN
BEGIN;
DROP FUNCTION IF EXISTS set_updated_at();
DROP FUNCTION IF EXISTS gen_uuid_v7();
-- DROP EXTENSION ...
COMMIT;
```

---

## Estratégia de Migrations — Manual (Append-Only SQL)

O projeto VULTRA adota **migrations manuais em SQL puro**. O Drizzle Kit é usado apenas para **execução**, nunca para geração automática de migrations.

| Ação | Comando | Observação |
|------|---------|------------|
| Executar migrations pendentes | `bun run db:migrate` | Equivale a `drizzle-kit migrate` |
| Inspecionar schema atual | `bun run db:studio` | Interface visual Drizzle Studio |

> **Proibido:** `drizzle-kit generate` — gera migrations automáticas que podem entrar em conflito com as migrations manuais e não respeitam as convenções do projeto (particionamento, RLS, triggers, HNSW).

---

## Processo de Deploy

1. Migrations rodam **antes** do deploy da nova versão da aplicação
2. A aplicação nunca sobe se houver migration pendente (health check deve verificar)
3. Em produção: sempre fazer backup antes de migrations com `ALTER TABLE` ou `DROP`
4. O índice HNSW (`0009`) pode ser recriado com `CREATE INDEX CONCURRENTLY` para evitar lock em produção com dados existentes
