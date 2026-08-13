---
name: drizzle-orm
description: >-
  Aplicar ao criar ou editar qualquer acesso ao PostgreSQL no api-core: schemas
  Drizzle (pgTable), queries SELECT/INSERT/UPDATE/DELETE com multitenancy,
  migrations SQL manuais (drizzle-kit generate é proibido), tipos customizados
  vector(512)/inet, busca vetorial com pgvector (operador <=>), withTenantContext(),
  ou configuração do client.ts. Use esta skill sempre que tocar em tabelas,
  migrations, organizationId no banco, embeddings biométricos, RLS, HNSW index,
  ou qualquer operação com drizzle-orm ou postgres.js.
---

# Drizzle ORM — Vultra (PostgreSQL 16 + pgvector 0.8)

## Overview

O Vultra usa Drizzle ORM com driver **postgres.js** rodando em **Bun**. Migrations são escritas **à mão em SQL puro** — `drizzle-kit generate` é **proibido**. Todo acesso ao banco de dados de tenant ocorre dentro de `withTenantContext()`, que ativa o RLS via `set_config`.

---

## When to Use This Skill

- Criar ou editar tabelas no schema Drizzle
- Escrever queries SELECT / INSERT / UPDATE / DELETE
- Criar uma nova migration SQL manual
- Configurar tipos customizados `vector` ou `inet`
- Implementar busca vetorial com pgvector (`<=>`)
- Configurar `drizzle.config.ts` ou o cliente `client.ts`

---

## Quick Start

```typescript
// Tabela de tenant — mínimo viável
export const eventos = pgTable('eventos', {
  id:             uuid('id').notNull().default(sql`gen_uuid_v7()`).primaryKey(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id, { onDelete: 'restrict' }),
  titulo:         text('titulo').notNull(),
  createdAt:      timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
export type Evento     = typeof eventos.$inferSelect;
export type NovoEvento = typeof eventos.$inferInsert;

// Query — sempre dentro de withTenantContext
const rows = await withTenantContext(orgId, (tx) =>
  tx.select().from(schema.eventos)
    .where(and(eq(schema.eventos.organizationId, orgId)))
);
```

---

## Key Rules

| Regra | Motivo |
|-------|--------|
| `drizzle-kit generate` é **proibido** | Conflita com migrations manuais, RLS, HNSW e triggers |
| Toda query de tenant usa `withTenantContext()` | Ativa RLS — isolamento entre clientes |
| `WHERE organization_id` em todo SELECT/UPDATE/DELETE | 2ª camada de proteção além do RLS |
| `prepare: false` no postgres.js | Prepared statements quebram `set_config` do RLS |
| Busca vetorial filtra `model_version` **antes** do `<=>` | Embeddings de modelos diferentes não são comparáveis |
| Nunca persistir imagem — apenas `vector(512)` | LGPD Art. 11 — infração se violado |

---

## Resources

### references/
- [`schema.md`](./references/schema.md) — padrão de tabela, tipos customizados `vector`/`inet`, UUID v7
- [`client.md`](./references/client.md) — `client.ts`, `withTenantContext()`, `withEfSearch()`
- [`queries.md`](./references/queries.md) — SELECT, INSERT, UPDATE com multitenancy
- [`pgvector.md`](./references/pgvector.md) — busca por cosseno, thresholds ArcFace, `ef_search`
- [`migrations.md`](./references/migrations.md) — política append-only, template UP/DOWN, `drizzle.config.ts`

### Arquivos do projeto
- [`apps/api-core/src/infrastructure/database/client.ts`](../../../apps/api-core/src/infrastructure/database/client.ts)
- [`apps/api-core/src/infrastructure/database/schema/`](../../../apps/api-core/src/infrastructure/database/schema/)
- [`apps/api-core/src/infrastructure/database/migrations/`](../../../apps/api-core/src/infrastructure/database/migrations/)
- [`docs/database/guias/multitenancy.md`](../../../docs/database/guias/multitenancy.md)
- [`docs/database/guias/queries-pgvector.md`](../../../docs/database/guias/queries-pgvector.md)
