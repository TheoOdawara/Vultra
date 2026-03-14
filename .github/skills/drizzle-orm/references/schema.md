# Schema Drizzle — Tipos Customizados, Padrões e UUID v7

## Tipos Customizados (`_types.ts`)

O Drizzle não suporta `vector` (pgvector) e `inet` nativamente. **Sempre importar** de `_types.ts`.

```typescript
// infrastructure/database/schema/_types.ts
import { customType } from 'drizzle-orm/pg-core';

// Embedding facial ArcFace — 512 dimensões
export const vector = customType<{
  data: number[];
  driverData: string;
  config: { dimensions: number };
}>({
  dataType: (config) => `vector(${config?.dimensions ?? 512})`,
  toDriver: (value: number[]): string => `[${value.join(',')}]`,
  fromDriver: (value: string): number[] => value.slice(1, -1).split(',').map(Number),
});

// IP nativo PostgreSQL — audit_logs.ip_address
export const inet = customType<{ data: string; driverData: string }>({
  dataType: () => 'inet',
});
```

Uso no schema:
```typescript
import { vector, inet } from './_types';

faceEmbedding: vector('face_embedding', { dimensions: 512 }).notNull(),
ipAddress:     inet('ip_address'),
```

---

## Padrão de Tabela de Tenant

Toda tabela com dados de tenant segue este template. **Sem exceções.**

```typescript
// schema/minha-entidade.ts
import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';

export const minhaEntidade = pgTable('minha_entidade', {
  // UUID v7 — ordenação cronológica nativa em B-Trees (definido em migration 0001)
  id: uuid('id').notNull().default(sql`gen_uuid_v7()`).primaryKey(),

  // FK obrigatória em toda tabela de tenant — onDelete restrict (nunca cascade em dados biométricos)
  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),

  // campos do domínio...
  nome:     text('nome').notNull(),
  isActive: boolean('is_active').notNull().default(true),

  // timestamps — sempre withTimezone
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// Sempre exportar ambos — usados nos Use Cases como tipos de I/O
export type MinhaEntidade    = typeof minhaEntidade.$inferSelect;
export type NovaMinhaEntidade = typeof minhaEntidade.$inferInsert;
```

---

## Soft Delete

Membros usam soft delete (`deleted_at`) — nunca `DELETE` físico de dados de tenant.

```typescript
deletedAt: timestamp('deleted_at', { withTimezone: true }), // nullable — NULL = ativo
```

Queries com soft delete sempre incluem o filtro:
```typescript
.where(and(
  eq(schema.members.organizationId, orgId),
  isNull(schema.members.deletedAt), // exclui deletados
))
```

---

## Barrel Export

```typescript
// schema/index.ts — re-exportar tudo para import limpo
export * from './organizations';
export * from './members';
export * from './devices';
export * from './biometric-profiles';
export * from './attendance-sessions';
export * from './attendance-records';
export * from './audit-logs';
export * from './_types';
```

Importar no codebase sempre via barrel:
```typescript
import * as schema from '../../infrastructure/database/schema';
```
