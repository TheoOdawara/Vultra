---
name: elysia-typebox
description: >-
  Aplicar ao criar ou editar qualquer handler HTTP no api-core do Vultra: rotas
  ElysiaJS (*.routes.ts), schemas TypeBox (t.Object(), t.String(), t.Number()…),
  middleware de autenticação via derive, bootstrap do servidor (server.ts),
  validação de body/query/params/response, guards, ou prefixos /v1/. Use esta
  skill sempre que escrever endpoints HTTP, schemas de validação TypeBox, integrar
  rotas com use cases, ou configurar o servidor Elysia. Atenção: Zod, Joi e Yup
  são proibidos no Vultra (ADR-001).
---

# ElysiaJS + TypeBox — Rotas Vultra

## Overview

Toda rota HTTP do Vultra usa **ElysiaJS** com validação **TypeBox** (`t.Object()`). Handlers são adaptadores puros — toda lógica fica nos Use Cases. O contexto autenticado (`currentUser`, `currentOrg`) é injetado via `derive`. Zod, Joi e `any` são proibidos (ADR-001).

---

## When to Use This Skill

- Criar ou modificar uma rota HTTP no api-core
- Definir schemas de validação de body, query ou response
- Criar middleware de `derive` para injeção de contexto
- Configurar o bootstrap da aplicação (`server.ts`)
- Proteger rotas com autenticação ou RBAC

---

## Quick Start

```typescript
// schemas/attendance.schema.ts
import { t, type Static } from 'elysia';
export const RecordAttendanceBodySchema = t.Object({
  sessionId:   t.String({ format: 'uuid' }),
  frameBase64: t.String({ minLength: 1 }),
});
export type RecordAttendanceBody = Static<typeof RecordAttendanceBodySchema>;

// routes/attendance.routes.ts
export const attendanceRoutes = new Elysia({ prefix: '/v1/attendance' })
  .derive(async ({ headers }) => {
    const session = await auth.api.getSession({ headers });
    if (!session?.user) throw new UnauthorizedError();
    return { currentUser: session.user, currentOrg: session.session.activeOrganizationId };
  })
  .post('/record',
    ({ body, currentOrg }) => recordAttendanceUseCase.execute({ ...body, organizationId: currentOrg }),
    { body: RecordAttendanceBodySchema, response: RecordAttendanceResponseSchema }
  );
```

---

## Key Rules

| Regra | Motivo |
|-------|--------|
| TypeBox (`t.Object()`) obrigatório — Zod/Joi/Yup **proibidos** | ADR-001: TypeBox é nativo do ElysiaJS, zero overhead |
| `any` proibido | Modo strict TypeScript obrigatório |
| Handlers são one-liners que chamam `useCase.execute()` | Handlers são adaptadores, não orquestradores |
| Toda rota começa com `/v1/` | Versionamento obrigatório |
| `organizationId` sempre de `currentOrg` (derive) — nunca de `body`/`params` | Escalada de privilégio se vier do cliente |
| Schemas em `schemas/*.schema.ts` — nunca inline na rota | Reutilização e testabilidade |

---

## Resources

### references/
- [`routes.md`](./references/routes.md) — anatomia completa de uma rota, `derive`, `guard`
- [`schemas.md`](./references/schemas.md) — padrões TypeBox, `Static<>`, tipos comuns reutilizáveis
- [`middleware.md`](./references/middleware.md) — `withAuth`, `withDeviceAuth`, `requireRole`, `globalErrorHandler`
- [`bootstrap.md`](./references/bootstrap.md) — `server.ts`, ordem dos plugins, prefixos de rotas

### Skill relacionada
- [`elysiajs/SKILL.md`](../elysiajs/SKILL.md) — referência completa da API ElysiaJS

### Arquivos do projeto
- `apps/api-core/src/adapters/http/` — rotas e plugins HTTP atuais do api-core
- [`docs/backend/guias/typebox-rotas.md`](../../../docs/backend/guias/typebox-rotas.md)
- [`docs/backend/adrs/ADR-001-typebox-sobre-zod.md`](../../../docs/backend/adrs/ADR-001-typebox-sobre-zod.md)
