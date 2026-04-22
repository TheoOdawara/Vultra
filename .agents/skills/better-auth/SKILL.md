---
name: better-auth
description: >-
  Aplicar ao criar ou editar qualquer lógica de autenticação no Vultra: middleware
  de sessão, proteção de rotas, RBAC com roles (admin/professor/rh/student),
  autenticação de dispositivos IoT (ESP32) via X-Device-Token, configuração do
  auth.ts com plugins Organization/RBAC/Multi-session, ou validação de sessão.
  Use esta skill sempre que os termos "login", "sessão", "permissão", "role",
  "device token", "ESP32 auth", "requireRole", "withAuth" ou "organizationId da
  sessão" aparecerem na conversa.
---

# Better Auth — Autenticação e RBAC Vultra

## Overview

O Vultra usa **Better Auth** com os plugins Organization, RBAC e Multi-session (máx. 3 simultâneas). Passkeys permanecem planejadas, mas **não** estão disponíveis na versão atualmente adotada no repositório. Usuários humanos autenticam via sessão; dispositivos ESP32 via headers `X-Device-Token` + `X-Device-Id`, com verificação segura do token. O `organizationId` **sempre** vem da sessão — nunca de parâmetros externos.

---

## When to Use This Skill

- Criar ou editar middleware de autenticação de usuário
- Proteger rotas com RBAC (`requireRole`)
- Implementar autenticação de dispositivo IoT (ESP32)
- Configurar o `auth.ts` com plugins Better Auth
- Revisar se uma rota está corretamente protegida

---

## Quick Start

```typescript
// adapters/http/auth.plugin.ts — usuário humano
export function withAuth(app: Elysia) {
  return app.derive(async ({ headers }) => {
    const session = await auth.api.getSession({ headers });
    if (!session?.user || !session.session.activeOrganizationId) throw new UnauthorizedError();
    return {
      currentUser: session.user,
      currentOrg:  session.session.activeOrganizationId as string,
    };
  });
}

// adapters/http/device-auth.plugin.ts — dispositivo ESP32
export function withDeviceAuth(app: Elysia) {
  return app.derive(async ({ headers }) => {
    const token = headers['x-device-token'];
    if (!token) throw new InvalidDeviceTokenError();
    const device = await findDeviceByToken(token); // ver references/iot-auth.md
    if (!device) throw new InvalidDeviceTokenError();
    return { authenticatedDevice: device };
  });
}
```

---

## Matriz de Permissões RBAC

| Permissão | `admin` | `professor` | `rh` | `student` |
|-----------|:-------:|:-----------:|:----:|:---------:|
| `attendance:write` | ✅ | ✅ | ❌ | ❌ |
| `attendance:read` | ✅ | ✅ | ✅ | ❌ |
| `reports:read` | ✅ | ❌ | ✅ | ❌ |
| `members:manage` | ✅ | ❌ | ❌ | ❌ |
| `admin:*` | ✅ | ❌ | ❌ | ❌ |

---

## Key Rules

| Regra | Motivo |
|-------|--------|
| `organizationId` **sempre** de `currentOrg` (sessão) | Usar param externo = escalada de privilégio |
| Token IoT armazenado como hash bcrypt — nunca texto plano | Se o banco vazar, tokens são inúteis |
| Comparar token com `Bun.password.verify()` — nunca `===` | bcrypt nativo do Bun, timing-safe |
| `allowUserToCreateOrganization: false` | Criação de org restrita ao super-admin |
| API key exibida **apenas uma vez** no Portal Admin | Rotação invalida imediatamente |

---

## Resources

### references/
- [`config.md`](./references/config.md) — `auth.ts` completo com todos os plugins e env vars
- [`middleware.md`](./references/middleware.md) — `withAuth`, `withDeviceAuth` com implementação completa
- [`rbac.md`](./references/rbac.md) — `requireRole()`, proteção de rotas admin, matriz completa
- [`iot-auth.md`](./references/iot-auth.md) — fluxo ESP32, `findDeviceByToken`, rotação de chave

### Skill relacionada
- [`elysiajs/integrations/better-auth.md`](../elysiajs/integrations/better-auth.md)

### Arquivos do projeto
- `apps/api-core/src/infrastructure/auth.ts` — configuração atual do Better Auth
- `apps/api-core/src/adapters/http/auth.plugin.ts` — plugin HTTP para sessão humana
- `apps/api-core/src/adapters/http/device-auth.plugin.ts` — plugin HTTP para autenticação de dispositivo
- [`docs/backend/manuais/autenticacao.md`](../../../docs/backend/manuais/autenticacao.md)
