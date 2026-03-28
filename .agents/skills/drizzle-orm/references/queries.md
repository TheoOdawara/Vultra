# Queries CRUD — Padrões com Multitenancy

Todo acesso ao banco fica em `adapters/repositories/`. **Nunca** executar queries em Use Cases ou handlers.

## SELECT

```typescript
import { eq, and, isNull } from 'drizzle-orm';
import { withTenantContext } from '../../infrastructure/database/client';
import * as schema from '../../infrastructure/database/schema';

// Listagem simples
const members = await withTenantContext(orgId, (tx) =>
  tx.select()
    .from(schema.members)
    .where(and(
      eq(schema.members.organizationId, orgId),
      eq(schema.members.isActive, true),
      isNull(schema.members.deletedAt),
    ))
);

// Com JOIN
const records = await withTenantContext(orgId, (tx) =>
  tx.select({
    recordId:    schema.attendanceRecords.id,
    memberName:  schema.members.fullName,
    confidence:  schema.attendanceRecords.confidenceScore,
    recordedAt:  schema.attendanceRecords.recordedAt,
  })
  .from(schema.attendanceRecords)
  .innerJoin(schema.members, and(
    eq(schema.attendanceRecords.memberId, schema.members.id),
    eq(schema.members.organizationId, orgId), // JOIN também filtra tenant
  ))
  .where(and(
    eq(schema.attendanceRecords.organizationId, orgId),
    eq(schema.attendanceRecords.sessionId, sessionId),
  ))
  .orderBy(schema.attendanceRecords.recordedAt)
);

// findById com validação de tenant
const [member] = await withTenantContext(orgId, (tx) =>
  tx.select()
    .from(schema.members)
    .where(and(
      eq(schema.members.organizationId, orgId),
      eq(schema.members.id, memberId),
    ))
    .limit(1)
);
if (!member) throw new MemberNotFoundError(memberId);
```

## INSERT

```typescript
// Sempre propagar organizationId explicitamente
const [created] = await withTenantContext(orgId, (tx) =>
  tx.insert(schema.members)
    .values({
      organizationId: orgId,
      fullName:       'João Silva',
      externalCode:   'RA-001',
      role:           'student',
    })
    .returning()
);
```

## UPDATE

`organizationId` **nunca** pode ser omitido do WHERE no UPDATE — mesmo que o `id` seja único.

```typescript
const [updated] = await withTenantContext(orgId, (tx) =>
  tx.update(schema.members)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(schema.members.organizationId, orgId), // NUNCA omitir
      eq(schema.members.id, memberId),
    ))
    .returning()
);
if (!updated) throw new MemberNotFoundError(memberId);
```

## Soft Delete

Nunca `DELETE` físico de dados de tenant. Usar `deletedAt`:

```typescript
await withTenantContext(orgId, (tx) =>
  tx.update(schema.members)
    .set({ deletedAt: new Date(), isActive: false })
    .where(and(
      eq(schema.members.organizationId, orgId),
      eq(schema.members.id, memberId),
    ))
);
```

## Verificar Existência (para 409 Conflict)

```typescript
const [existing] = await withTenantContext(orgId, (tx) =>
  tx.select({ id: schema.attendanceRecords.id })
    .from(schema.attendanceRecords)
    .where(and(
      eq(schema.attendanceRecords.organizationId, orgId),
      eq(schema.attendanceRecords.sessionId, sessionId),
      eq(schema.attendanceRecords.memberId, memberId),
    ))
    .limit(1)
);
if (existing) throw new AttendanceConflictError(memberId, sessionId);
```
