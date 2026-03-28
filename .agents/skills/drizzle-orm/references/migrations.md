# Migrations — Política Append-Only

## Convenção de Nomenclatura

```
0001_init_extensions_uuid_v7.sql
0002_create_organizations.sql
0003_create_members.sql
...
NNNN_descricao_em_snake_case.sql
```

- Numeração sequencial de **4 dígitos** com zero-padding (`0001`, `0010`, `0100`)
- Sem gaps na sequência
- Nome descritivo em `snake_case`
- **Nunca** editar um arquivo já executado em produção

---

## Template de Migration

```sql
-- UP
BEGIN;
  CREATE TABLE IF NOT EXISTS minha_entidade (
    id               UUID         PRIMARY KEY DEFAULT gen_uuid_v7(),
    organization_id  UUID         NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    nome             TEXT         NOT NULL,
    is_active        BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  );

  -- Trigger de updated_at (função set_updated_at definida em 0001)
  CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON minha_entidade
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

  -- RLS obrigatório em toda tabela de tenant
  ALTER TABLE minha_entidade ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON minha_entidade
    USING (organization_id::text = current_setting('app.current_org_id', TRUE));

  -- Índices (adicionar conforme necessidade de query)
  CREATE INDEX idx_minha_entidade_org ON minha_entidade (organization_id);
COMMIT;

-- DOWN
BEGIN;
  DROP TABLE IF EXISTS minha_entidade;
COMMIT;
```

---

## Regras

| Regra | Detalhe |
|-------|---------|
| `drizzle-kit generate` **proibido** | Gera SQL que conflita com RLS, HNSW, triggers e particionamento |
| Append-only | Nunca alterar arquivo executado em produção — criar nova migration |
| `BEGIN / COMMIT` | Todo DDL dentro de transação |
| `-- UP` + `-- DOWN` | Ambos obrigatórios para rollback seguro |
| Backup antes de `ALTER TABLE` / `DROP` | Obrigatório — sem backup, sem migration destrutiva |
| Migrations rodam **antes** do deploy | App nunca sobe com migration pendente |

---

## `drizzle.config.ts`

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema:        './src/infrastructure/database/schema/index.ts',
  out:           './src/infrastructure/database/migrations',
  dialect:       'postgresql',
  dbCredentials: { url: process.env['DATABASE_URL']! },
  verbose:       true,
  strict:        true,
} satisfies Config;
```

---

## Comandos

```bash
bun run db:migrate   # executa migrations pendentes via drizzle-kit migrate
bun run db:studio    # abre interface visual Drizzle Studio
```

---

## Funções Globais (definidas em 0001)

| Função | Descrição |
|--------|-----------|
| `gen_uuid_v7()` | UUID v7 (RFC 9562) — ordenação temporal em B-Trees |
| `set_updated_at()` | Trigger BEFORE UPDATE que atualiza `updated_at` automaticamente |

---

## Particionamento (attendance_records)

A tabela `attendance_records` é **particionada por `recorded_at`** (trimestral). Ao criar migrations relacionadas a ela, não usar `CREATE TABLE` simples — referenciar o padrão existente na migration `0007`.
