# Better Auth — RBAC (Roles & Permissões)

## Matrix de Permissões

| Role | Endpoints Permitidos | Endpoints Proibidos |
|------|---------------------|---------------------|
| `admin` | Tudo (`/v1/admin/**`, `/v1/**`) | — |
| `professor` | `/v1/sessions/**`, `/v1/attendance/**`, `/v1/reports/class/**` | `/v1/admin/**`, `/v1/rh/**` |
| `rh` | `/v1/rh/**`, `/v1/reports/org/**`, `/v1/biometric/**` | `/v1/admin/**`, endpoints de sessão de aula |
| `student` | (sem acesso direto à API) | Todos os endpoints autenticados |
| `device` (ESP32) | `/v1/iot/**` | Todos os endpoints de usuário |

---

## `requireRole()` Helper

```typescript
// adapters/http/middleware/requireRole.ts
import { InsufficientPermissionsError } from '../../../core/errors';

type Role = 'admin' | 'professor' | 'rh';

export function requireRole(...allowed: Role[]) {
  return ({ user }: { user: { role: string } }) => {
    if (!allowed.includes(user.role as Role)) {
      throw new InsufficientPermissionsError();
    }
  };
}
```

### Uso em Rotas

```typescript
import { requireRole } from '../middleware/requireRole';

// Rota protegida para admin apenas
app.use(withAuth).get(
  '/v1/admin/organizations',
  ({ user }) => {
    requireRole('admin')({ user });
    // ... lógica
  }
);

// Prefixo inteiro protegido via guard
const adminRoutes = new Elysia({ prefix: '/v1/admin' })
  .use(withAuth)
  .guard({
    beforeHandle: ({ user }) => requireRole('admin')({ user }),
  })
  .get('/organizations', handler)
  .post('/organizations', handler);
```

---

## Consultar Role do Membro na Organização

```typescript
// Obter role do membro na organização ativa
const member = await auth.api.getOrganizationMember({
  headers:        request.headers,
  organizationId: session.session.activeOrganizationId,
});

const orgRole = member?.role; // 'admin' | 'member' | custom
```

> **Nota:** Better Auth gerencia roles no nível de organização via plugin RBAC. O campo `user.role` do Better Auth é o role global; para roles de organização, use `getOrganizationMember`.
