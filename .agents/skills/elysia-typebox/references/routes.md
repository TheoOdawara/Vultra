# Anatomia Completa de uma Rota

## Estrutura de Arquivos

```
src/adapters/http/
├── schemas/
│   └── attendance.schema.ts     ← t.Object() definido aqui, nunca inline
├── routes/
│   └── attendance.routes.ts     ← importa schema + use case do container
└── middleware/
    ├── auth.middleware.ts
    ├── device-auth.middleware.ts
    └── global-error.middleware.ts
```

---

## Rota Completa — POST com body validado

```typescript
// adapters/http/routes/attendance.routes.ts
import Elysia from 'elysia';
import { auth }                        from '../../../infrastructure/auth';
import { recordAttendanceUseCase }     from '../../../infrastructure/container';
import {
  RecordAttendanceBodySchema,
  RecordAttendanceResponseSchema,
} from '../schemas/attendance.schema';
import { UnauthorizedError } from '../../../core/domain/errors/UnauthorizedError';

export const attendanceRoutes = new Elysia({ prefix: '/v1/attendance' })
  .derive(async ({ headers }) => {
    const session = await auth.api.getSession({ headers });
    if (!session?.user || !session.session.activeOrganizationId) throw new UnauthorizedError();
    return {
      currentUser: session.user,
      currentOrg:  session.session.activeOrganizationId as string,
    };
  })
  .post(
    '/record',
    ({ body, currentOrg }) =>
      recordAttendanceUseCase.execute({ ...body, organizationId: currentOrg }),
    {
      body:     RecordAttendanceBodySchema,
      response: RecordAttendanceResponseSchema,
    },
  );
```

---

## GET com query params e paginação

```typescript
.get(
  '/sessions',
  ({ query, currentOrg }) =>
    listSessionsUseCase.execute({ ...query, organizationId: currentOrg }),
  {
    query: t.Object({
      page:   t.Optional(t.Number({ minimum: 1, default: 1 })),
      limit:  t.Optional(t.Number({ minimum: 1, maximum: 100, default: 20 })),
      status: t.Optional(t.Union([t.Literal('open'), t.Literal('closed')])),
    }),
    response: t.Object({
      data:  t.Array(SessionSchema),
      total: t.Number(),
    }),
  },
);
```

---

## PATCH com params de rota

```typescript
.patch(
  '/sessions/:id/close',
  ({ params, currentOrg }) =>
    closeSessionUseCase.execute({ sessionId: params.id, organizationId: currentOrg }),
  {
    params:   t.Object({ id: t.String({ format: 'uuid' }) }),
    response: t.Object({ closedAt: t.String({ format: 'date-time' }) }),
  },
);
```

---

## Rota de Dispositivo IoT (sem sessão de usuário)

```typescript
export const iotAttendanceRoutes = new Elysia({ prefix: '/v1/iot/attendance' })
  .derive(async ({ headers }) => {
    const token = headers['x-device-token'];
    if (!token) throw new InvalidDeviceTokenError();
    const device = await findDeviceByToken(token);
    if (!device) throw new InvalidDeviceTokenError();
    return { authenticatedDevice: device };
  })
  .post(
    '/record',
    ({ body, authenticatedDevice }) =>
      recordAttendanceUseCase.execute({
        ...body,
        organizationId: authenticatedDevice.organizationId,
        deviceId:       authenticatedDevice.id,
      }),
    { body: IotRecordBodySchema },
  );
```

---

## Prefixos de Rotas (Convenção)

| Recurso | Prefixo |
|---------|---------|
| Presenças | `/v1/attendance` |
| Sessões | `/v1/attendance/sessions` |
| Membros | `/v1/members` |
| Dispositivos | `/v1/devices` |
| Biometria | `/v1/biometric` |
| Relatórios | `/v1/reports` |
| Saúde do sistema | `/v1/health` |
| Administração | `/v1/admin` |
| IoT (ESP32) | `/v1/iot` |
