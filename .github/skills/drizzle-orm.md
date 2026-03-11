# Drizzle ORM — Vultra (PostgreSQL + pgvector)

## Visão Geral

O Vultra usa **Drizzle ORM** com **postgres.js** como driver, rodando em **Bun**. O banco é **PostgreSQL 16 + pgvector 0.7**. As migrações são escritas à **mão em SQL puro** e executadas via `drizzle-kit migrate`. **Nunca usar `drizzle-kit generate`** — geração automática de SQL está proibida pelo projeto.

---

## Estrutura de Ficheiros

```
apps/api-core/src/infrastructure/database/
├── client.ts                  ← instância db, withTenantContext, withEfSearch
├── schema/
│   ├── _types.ts              ← tipos customizados: vector, inet
│   ├── index.ts               ← barrel export
│   ├── organizations.ts
│   ├── members.ts
│   ├── devices.ts
│   ├── biometric-profiles.ts
│   ├── attendance-sessions.ts
│   ├── attendance-records.ts
│   └── audit-logs.ts
└── migrations/
    ├── 0001_init_extensions_uuid_v7.sql
    └── ... (append-only, nunca editar após produção)
```

---

## Tipo Customizado: `vector(N)` (pgvector)

O Drizzle não suporta `vector` nativamente — usar o tipo customizado de `_types.ts`:

```typescript
import { customType } from 'drizzle-orm/pg-core';

export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 512})`;
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value.slice(1, -1).split(',').map(Number);
  },
});
```

Uso no schema:
```typescript
import { vector } from './_types';

faceEmbedding: vector('face_embedding', { dimensions: 512 }).notNull(),
```

**Regra LGPD inviolável:** apenas o vetor é persistido. Imagem processada na RAM e descartada imediatamente.

---

## Tipo Customizado: `inet` (IP PostgreSQL)

```typescript
export const inet = customType<{ data: string; driverData: string }>({
  dataType() { return 'inet'; },
});
```

Usado em `audit_logs.ip_address`.

---

## Padrão de Schema

Todas as tabelas seguem estas convenções:

```typescript
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const minhaTabela = pgTable('minha_tabela', {
  // UUID v7 via função SQL customizada (gen_uuid_v7) — definida na migration 0001
  id: uuid('id')
    .notNull()
    .default(sql`gen_uuid_v7()`)
    .primaryKey(),

  // Multitenancy: obrigatório em TODAS as tabelas de dados de tenant
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),

  // ... campos

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Tipos inferidos — SEMPRE exportar ambos
export type MinhaTabela    = typeof minhaTabela.$inferSelect;
export type NovaMinhaTabela = typeof minhaTabela.$inferInsert;
```

---

## Instância do Cliente

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres    from 'postgres';
import * as schema from './schema';

const queryClient = postgres(process.env['DATABASE_URL']!, {
  max:             20,
  idle_timeout:    30,
  connect_timeout: 10,
  prepare:         false, // OBRIGATÓRIO — desabilita prepared statements para compatibilidade com RLS set_config
});

export const db = drizzle(queryClient, { schema });
```

---

## Multitenancy: `withTenantContext`

**Regra crítica:** TODO endpoint autenticado deve executar queries dentro de `withTenantContext`. Nunca fazer queries de tenant fora desta função.

```typescript
export async function withTenantContext<T>(
  organizationId: string,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    // Ativa RLS para o tenant — escopo de transação (TRUE), nunca vaza entre requests
    await tx.execute(
      sql`SELECT set_config('app.current_org_id', ${organizationId}, TRUE)`,
    );
    return fn(tx as unknown as Database);
  });
}

// Uso em repositórios:
const members = await withTenantContext(ctx.organizationId, (tx) =>
  tx.select()
    .from(schema.members)
    .where(
      and(
        eq(schema.members.organizationId, ctx.organizationId), // filtro app-level
        eq(schema.members.isActive, true),
      )
    )
);
```

A proteção é de **3 camadas**:
1. `WHERE organization_id = ?` no código (repositório)
2. `set_config('app.current_org_id')` + políticas RLS no banco
3. `organizationId` injetado via `derive()` do Better Auth no ElysiaJS

---

## Busca Vetorial por Cosseno (Reconhecimento Facial)

O operador `<=>` é do pgvector (distância cosseno). Não existe suporte nativo no Drizzle — usar `sql` raw com `withTenantContext` e `withEfSearch`:

```typescript
import { sql } from 'drizzle-orm';
import { db, withTenantContext, withEfSearch } from '../database/client';
import { biometricProfiles } from '../database/schema';

async function findMemberByEmbedding(
  embedding: number[],
  organizationId: string,
  threshold = 0.85,
  currentModelVersion = 'ArcFace-v1',
) {
  return withTenantContext(organizationId, (tx) =>
    withEfSearch(tx, 80, async (txEf) => {
      const embeddingLiteral = `[${embedding.join(',')}]`;

      const [result] = await txEf.execute<{
        member_id: string;
        similarity: number;
        model_version: string;
      }>(sql`
        SELECT
          member_id,
          1 - (face_embedding <=> ${embeddingLiteral}::vector) AS similarity,
          model_version
        FROM biometric_profiles
        WHERE
          organization_id = ${organizationId}       -- isolamento obrigatório
          AND model_version = ${currentModelVersion} -- evitar mismatch de modelo
          AND is_active = TRUE
        ORDER BY face_embedding <=> ${embeddingLiteral}::vector
        LIMIT 1
      `);

      if (!result || result.similarity < threshold) return null;
      return result;
    })
  );
}
```

Regras de ouro para queries pgvector:
- **Sempre** filtrar `organization_id` ANTES do operador vetorial
- **Sempre** filtrar `model_version = $currentModel` — vetores de modelos diferentes não são comparáveis
- **Sempre** filtrar `is_active = TRUE`
- Threshold padrão do ArcFace: **0.85**
- Usar `withEfSearch` com `efSearch = 80` para aumentar recall em produção

---

## `withEfSearch` — Recall HNSW

Para queries de reconhecimento onde recall é crítico, aumentar o `ef_search` do índice HNSW:

```typescript
export async function withEfSearch<T>(
  db: Database,
  efSearch: number,
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SET LOCAL hnsw.ef_search = ${efSearch}`);
    return fn(tx as unknown as Database);
  });
}
```

---

## Migrações (Política Append-Only)

```
migrations/
├── 0001_init_extensions_uuid_v7.sql   ← extensões e gen_uuid_v7
├── 0002_create_organizations.sql
└── NNNN_descricao_em_snake_case.sql
```

**Regras absolutas:**
- ❌ **Nunca** usar `drizzle-kit generate` — todas as migrations são escritas à mão
- ❌ **Nunca** editar um arquivo de migration já executado em produção
- ✅ Toda migration deve ter bloco `-- UP` e `-- DOWN`
- ✅ DDL dentro de `BEGIN` / `COMMIT`
- ✅ Numeração sequencial de 4 dígitos (`0001`, `0002`, ...)

Estrutura de um arquivo de migration:
```sql
-- UP
BEGIN;
  CREATE TABLE IF NOT EXISTS minha_tabela (
    id UUID PRIMARY KEY DEFAULT gen_uuid_v7(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    -- ...
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- RLS
  ALTER TABLE minha_tabela ENABLE ROW LEVEL SECURITY;
  CREATE POLICY tenant_isolation ON minha_tabela
    USING (organization_id::text = current_setting('app.current_org_id', TRUE));
COMMIT;

-- DOWN
BEGIN;
  DROP TABLE IF EXISTS minha_tabela;
COMMIT;
```

Executar com:
```bash
bunx drizzle-kit migrate
```

---

## Drizzle Config (`drizzle.config.ts`)

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema:    './src/infrastructure/database/schema/index.ts',
  out:       './src/infrastructure/database/migrations',
  dialect:   'postgresql',
  dbCredentials: {
    url: process.env['DATABASE_URL']!,
  },
  verbose: true,
  strict:  true,
} satisfies Config;
```

---

## Queries Drizzle ORM Comuns

### Select com filtro de tenant
```typescript
import { eq, and } from 'drizzle-orm';

const rows = await withTenantContext(orgId, (tx) =>
  tx.select()
    .from(schema.members)
    .where(
      and(
        eq(schema.members.organizationId, orgId),
        eq(schema.members.isActive, true),
      )
    )
);
```

### Insert
```typescript
const [created] = await withTenantContext(orgId, (tx) =>
  tx.insert(schema.members)
    .values({ organizationId: orgId, name: 'João', externalCode: 'RA-001' })
    .returning()
);
```

### Update (sempre com organizationId no WHERE)
```typescript
await withTenantContext(orgId, (tx) =>
  tx.update(schema.members)
    .set({ isActive: false })
    .where(
      and(
        eq(schema.members.organizationId, orgId), // NUNCA omitir
        eq(schema.members.id, memberId),
      )
    )
);
```

---

## O Que Nunca Fazer

| Proibido | Porquê |
|---|---|
| `drizzle-kit generate` | Migrations são append-only e escritas à mão |
| Query sem `organization_id` | Fuga de dados entre tenants — falha P0 |
| Persistir imagem no banco | LGPD Art. 11 — apenas `vector(512)` |
| `any` no TypeScript | Modo strict obrigatório |
| Zod/Joi para validação | TypeBox obrigatório nas rotas ElysiaJS |
| `prepare: true` no postgres.js | Incompatível com RLS `set_config` |
| Busca vetorial sem `model_version` | Mismatch silencioso entre modelos |
