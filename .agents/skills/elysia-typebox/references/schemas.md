# Schemas TypeBox — Padrões e Tipos Comuns

## Estrutura de um Arquivo de Schema

```typescript
// adapters/http/schemas/attendance.schema.ts
import { t, type Static } from 'elysia';

// Body do POST /attendance/record
export const RecordAttendanceBodySchema = t.Object({
  sessionId:   t.String({ format: 'uuid', description: 'ID da sessão de presença ativa' }),
  frameBase64: t.String({ minLength: 1, description: 'Frame JPEG em base64 do ESP32' }),
});

// Response do POST /attendance/record
export const RecordAttendanceResponseSchema = t.Object({
  recordId:        t.String({ format: 'uuid' }),
  confidenceScore: t.Number({ minimum: 0, maximum: 1 }),
  sentimentLabel:  t.Optional(t.String()),
  recordedAt:      t.String({ format: 'date-time' }),
});

// Tipos TypeScript inferidos — usar em Use Cases, portas e repositórios
export type RecordAttendanceBody     = Static<typeof RecordAttendanceBodySchema>;
export type RecordAttendanceResponse = Static<typeof RecordAttendanceResponseSchema>;
```

---

## Tipos Reutilizáveis (Namespace Compartilhado)

```typescript
// adapters/http/schemas/_common.schema.ts
import { t } from 'elysia';

export const UuidParam = t.Object({
  id: t.String({ format: 'uuid' }),
});

export const Pagination = t.Object({
  page:  t.Optional(t.Number({ minimum: 1, default: 1 })),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
});

export const DateRangeQuery = t.Object({
  from: t.String({ format: 'date-time' }),
  to:   t.String({ format: 'date-time' }),
});

export const SuccessResponse = t.Object({
  success: t.Literal(true),
  message: t.Optional(t.String()),
});
```

---

## Padrões TypeBox por Caso de Uso

### Enum como Union literal
```typescript
// Usar t.Union de Literals — não enum TS
export const AttendanceStatusSchema = t.Union([
  t.Literal('open'),
  t.Literal('closed'),
  t.Literal('cancelled'),
]);
export type AttendanceStatus = Static<typeof AttendanceStatusSchema>;
```

### Array com validação de item
```typescript
export const BulkCreateMembersBodySchema = t.Object({
  members: t.Array(
    t.Object({
      fullName:     t.String({ minLength: 2 }),
      externalCode: t.Optional(t.String()),
      role:         t.Union([t.Literal('student'), t.Literal('professor')]),
    }),
    { minItems: 1, maxItems: 500 }
  ),
});
```

### Nullable vs Optional
```typescript
// Optional = pode não estar presente no objeto
sentimentLabel: t.Optional(t.String())  // { sentimentLabel?: string }

// Nullable = está presente, mas pode ser null
deletedAt: t.Nullable(t.String({ format: 'date-time' }))  // { deletedAt: string | null }
```

### Response com paginação
```typescript
export const PaginatedMembersSchema = t.Object({
  data:       t.Array(MemberSchema),
  total:      t.Number(),
  page:       t.Number(),
  totalPages: t.Number(),
});
```

---

## Regras

- Schemas sempre em `schemas/*.schema.ts` — nunca inline na rota
- Sempre exportar o tipo `Static<typeof Schema>` junto ao schema
- Usar `t.String({ format: 'uuid' })` para IDs — validação automática de formato
- Nunca colocar `organizationId` no body schema — vem de `currentOrg` (derive)
