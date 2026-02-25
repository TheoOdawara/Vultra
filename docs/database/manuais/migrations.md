# 🔄 Política de Migrations

> **← [Voltar ao Database](../README.md)**

---

## Convenção de Nomenclatura

```
migrations/
├── 001_init_organizations.sql
├── 002_add_pgvector_extension.sql
├── 003_create_members.sql
├── 004_create_biometric_profiles.sql
├── 005_add_hnsw_index.sql
└── 006_add_sentiment_columns.sql
```

- Numeração **sequencial com 3 dígitos** (`001`, `002`, ...)
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
| **Ferramenta** | `dbmate` ou `golang-migrate` para controle de versão e execução |

---

## Migration Inicial (`001_init_organizations.sql`)

Deve habilitar as extensões necessárias antes de criar as tabelas:

```sql
-- UP
BEGIN;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgvector";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
-- ... criação das tabelas
COMMIT;

-- DOWN
BEGIN;
-- DROP TABLE em ordem reversa de dependências
COMMIT;
```

---

## Processo de Deploy

1. Migrations rodam **antes** do deploy da nova versão da aplicação
2. A aplicação nunca sobe se houver migration pendente (health check deve verificar)
3. Em produção: sempre fazer backup antes de migrations com `ALTER TABLE` ou `DROP`
