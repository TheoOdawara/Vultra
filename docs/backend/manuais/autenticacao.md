# 🔐 Autenticação — API Core

> **← [Voltar ao Backend](../README.md)**

---

## Better Auth — Configuração

O Better Auth é inicializado em `infrastructure/auth.ts` com os seguintes plugins:

| Plugin | Configuração |
|--------|-------------|
| `organization` | Criação de orgs restrita ao super-admin |
| `rbac` | Permissões por role definidas na tabela abaixo |
| `passkey` | Autenticação biométrica via WebAuthn (FIDO2) |
| `multiSession` | Máximo de **3 sessões simultâneas** por usuário |

---

## RBAC — Matriz de Permissões

| Role | `attendance:write` | `attendance:read` | `reports:read` | `members:manage` | `admin:*` |
|------|:---:|:---:|:---:|:---:|:---:|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ |
| `professor` | ✅ | ✅ | ❌ | ❌ | ❌ |
| `rh` | ❌ | ✅ | ✅ | ❌ | ❌ |
| `student` | ❌ | ❌ | ❌ | ❌ | ❌ |

A role é verificada via `ctx.currentUser.role` (injetado pelo `derive`). Rotas que exigem permissão devem usar o guard `requirePermission()` antes do handler.

---

## Injeção de Contexto via `derive`

O contexto de auth é injetado em todas as rotas protegidas via `.derive()`. O handler nunca chama `auth.api.getSession()` diretamente.

```typescript
// infrastructure/auth.ts — padrão de derive para rotas autenticadas
async ({ headers }) => {
  const session = await auth.api.getSession({ headers });
  if (!session) throw new UnauthorizedError();
  return { currentUser: session.user, currentOrg: session.session.activeOrganizationId };
}
```

---

## Autenticação de Dispositivos IoT (ESP32)

Dispositivos ESP32 não usam sessões JWT. Autenticam via header `X-Device-Token`.

### Fluxo de validação

1. O middleware `deviceAuthMiddleware` extrai o valor do header `X-Device-Token`
2. Busca o dispositivo na tabela `devices` pelo `organization_id` do tenant
3. Compara o token recebido com o hash bcrypt armazenado via `Bun.password.verify()`
4. Se válido, injeta o objeto `authenticatedDevice` via `derive` para o handler
5. Se inválido: `401 INVALID_DEVICE_TOKEN`

### Segurança da chave

- A `apiKey` plaintext é exibida **apenas uma vez** no Portal Admin no momento do cadastro
- Somente o hash bcrypt é armazenado na coluna `api_key_hash`
- Rotação de chave gera novo hash — a chave antiga é imediatamente invalidada

---

## Proteção de Rotas

| Tipo de Rota | Middleware | Contexto Injetado |
|-------------|-----------|-----------------|
| Rotas de usuário | `authMiddleware` | `currentUser`, `currentOrg` |
| Rotas de dispositivo | `deviceAuthMiddleware` | `authenticatedDevice` |
| Rotas públicas | — | — |
| Rotas admin (`/v1/admin/`) | `authMiddleware` + `requireRole('admin')` | `currentUser` |
