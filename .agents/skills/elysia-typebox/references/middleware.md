# Middleware — `derive`, Auth e Error Handler

## `withAuth` — Middleware de Usuário

```typescript
// adapters/http/middleware/auth.middleware.ts
import Elysia from 'elysia';
import { auth }              from '../../../infrastructure/auth';
import { UnauthorizedError } from '../../../core/domain/errors/UnauthorizedError';

export function withAuth(app: Elysia) {
  return app.derive(async ({ headers }) => {
    const session = await auth.api.getSession({ headers });
    if (!session?.user || !session.session.activeOrganizationId) {
      throw new UnauthorizedError();
    }
    return {
      currentUser: session.user,
      currentOrg:  session.session.activeOrganizationId as string,
    };
  });
}
```

Uso em rotas:
```typescript
new Elysia({ prefix: '/v1/members' })
  .use(withAuth)
  .get('/', ({ currentOrg }) => listMembersUseCase.execute({ organizationId: currentOrg }))
```

---

## `withDeviceAuth` — Middleware IoT (ESP32)

```typescript
// adapters/http/middleware/device-auth.middleware.ts
import Elysia from 'elysia';
import { db }                        from '../../../infrastructure/database/client';
import * as schema                   from '../../../infrastructure/database/schema';
import { eq, and }                   from 'drizzle-orm';
import { InvalidDeviceTokenError }   from '../../../core/domain/errors/InvalidDeviceTokenError';

export function withDeviceAuth(app: Elysia) {
  return app.derive(async ({ headers }) => {
    const token = headers['x-device-token'];
    if (!token) throw new InvalidDeviceTokenError();

    // Busca todos os devices ativos e valida com bcrypt
    // api_key_hash tem índice UNIQUE — scan limitado
    const devices = await db
      .select()
      .from(schema.devices)
      .where(eq(schema.devices.isActive, true));

    let matched = null;
    for (const device of devices) {
      if (await Bun.password.verify(token, device.apiKeyHash)) {
        matched = device;
        break;
      }
    }

    if (!matched) throw new InvalidDeviceTokenError();

    // Atualiza last_seen_at sem bloquear a resposta
    db.update(schema.devices)
      .set({ lastSeenAt: new Date() })
      .where(eq(schema.devices.id, matched.id))
      .catch(() => {}); // fire-and-forget

    return { authenticatedDevice: matched };
  });
}
```

---

## `globalErrorHandler` — Error Handler Central

Deve ser o **primeiro** plugin montado no `server.ts`.

```typescript
// adapters/http/middleware/global-error.middleware.ts
import Elysia        from 'elysia';
import { DomainError } from '../../../core/domain/errors/DomainError';

export function globalErrorHandler(app: Elysia) {
  return app.onError(({ error, set }) => {
    // 1. Erros de domínio mapeados para HTTP semântico
    if (error instanceof DomainError) {
      set.status = error.httpStatus;
      return { error: error.code, message: error.message };
    }

    // 2. Erros de validação TypeBox
    if (error.name === 'ValidationError') {
      set.status = 400;
      return { error: 'VALIDATION_ERROR', message: error.message };
    }

    // 3. Fallback — nunca expor stack em produção
    set.status = 500;
    if (process.env['NODE_ENV'] !== 'production') {
      return { error: 'INTERNAL_ERROR', message: error.message };
    }
    return { error: 'INTERNAL_ERROR' };
  });
}
```
