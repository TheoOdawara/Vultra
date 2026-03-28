# Better Auth — Middleware (`withAuth` e `withDeviceAuth`)

## `withAuth` — Usuários Humanos

```typescript
// adapters/http/middleware/withAuth.ts
import Elysia from 'elysia';
import { auth } from '../../../infrastructure/auth';
import { UnauthorizedError } from '../../../core/errors';

export const withAuth = new Elysia({ name: 'withAuth' })
  .derive({ as: 'scoped' }, async ({ request }) => {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session?.user || !session?.session) {
      throw new UnauthorizedError();
    }

    return {
      user:         session.user,
      session:      session.session,
      organizationId: session.session.activeOrganizationId ?? null,
    };
  });
```

> **Nota:** `as: 'scoped'` garante que o contexto não vaza para plugins externos.

---

## `withDeviceAuth` — ESP32-CAM (IoT)

```typescript
// adapters/http/middleware/withDeviceAuth.ts
import Elysia from 'elysia';
import { db }  from '../../../infrastructure/database/client';
import { devices } from '../../../infrastructure/database/schema';
import { eq, and } from 'drizzle-orm';
import { InvalidDeviceTokenError } from '../../../core/errors';

export const withDeviceAuth = new Elysia({ name: 'withDeviceAuth' })
  .derive({ as: 'scoped' }, async ({ headers }) => {
    const token    = headers['x-device-token'];
    const deviceId = headers['x-device-id'];

    if (!token || !deviceId) throw new InvalidDeviceTokenError();

    const [device] = await db
      .select()
      .from(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.isActive, true)))
      .limit(1);

    if (!device) throw new InvalidDeviceTokenError();

    // Bcrypt: comparar token enviado com hash armazenado
    const valid = await Bun.password.verify(token, device.tokenHash);
    if (!valid) throw new InvalidDeviceTokenError();

    // Fire-and-forget: atualizar last_seen_at sem bloquear resposta
    db.update(devices)
      .set({ lastSeenAt: new Date() })
      .where(eq(devices.id, deviceId))
      .execute();

    return { device };
  });
```

---

## Princípios

| Ponto | Detalhe |
|-------|---------|
| Header IoT | `X-Device-Token` (senha) + `X-Device-Id` (identificador) |
| Hash de API Key | `Bun.password.verify()` — bcrypt com cost 12 |
| Erro genérico | Retornar sempre `InvalidDeviceTokenError` (não vazar qual campo falhou) |
| `last_seen_at` | Atualizar fire-and-forget — não bloquear resposta |
| `as: 'scoped'` | Obrigatório para evitar vazamento de contexto entre plugins |
