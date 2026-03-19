# Better Auth — Configuração (`infrastructure/auth.ts`)

## Setup Completo

```typescript
// infrastructure/auth.ts
import { betterAuth }   from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization } from 'better-auth/plugins/organization';
import { rbac }         from 'better-auth/plugins/rbac';
import { passkey }      from 'better-auth/plugins/passkey';
import { multiSession } from 'better-auth/plugins/multi-session';
import { db }           from './database/client';
import * as schema      from './database/schema';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg', schema }),
  secret:   process.env['BETTER_AUTH_SECRET']!,
  baseURL:  process.env['BETTER_AUTH_URL']!,

  plugins: [
    organization({
      allowUserToCreateOrganization: false, // restrito ao super-admin
    }),
    rbac(),
    passkey(),          // WebAuthn/FIDO2 — biometria de usuário (NÃO confundir com facial)
    multiSession({ maximumSessions: 3 }),
  ],
});
```

---

## Variáveis de Ambiente

| Variável | Como gerar | Descrição |
|----------|-----------|-----------|
| `BETTER_AUTH_SECRET` | `openssl rand -base64 64` | Segredo JWT — mínimo 64 bytes |
| `BETTER_AUTH_URL` | `http://localhost:3000` (dev) | URL base para callbacks OAuth e e-mail |

---

## Plugins e Responsabilidades

| Plugin | Responsabilidade |
|--------|-----------------|
| `organization` | Multitenancy — organizações, membros de org, convites |
| `rbac` | Roles e permissões (`admin`, `professor`, `rh`, `student`) |
| `passkey` | WebAuthn/FIDO2 para login sem senha (usuários humanos) |
| `multiSession` | Máx. 3 sessões simultâneas por usuário |
