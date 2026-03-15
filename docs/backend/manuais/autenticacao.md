# 🔐 Autenticação — API Core

> **← [Voltar ao Backend](../README.md)**

---

## Better Auth — Configuração

O Better Auth é inicializado em `infrastructure/auth.ts` com os seguintes plugins:

| Plugin | Status | Configuração |
|--------|--------|-------------|
| `organization` | ✅ Ativo | Criação de orgs restrita ao super-admin (`allowUserToCreateOrganization: false`) |
| `rbac` (via `organization`) | ✅ Ativo | Permissões por role via `createAccessControl` (ver tabela abaixo) |
| `multiSession` | ✅ Ativo | Máximo de **3 sessões simultâneas** por utilizador |
| `passkey` | ⚠️ Indisponível | Não incluído no better-auth 1.x — será habilitado quando upstream disponibilizar |

---

## RBAC — Matriz de Permissões (AccessControl real)

Definido via `createAccessControl` em `infrastructure/auth.ts`. Os recursos e ações correspondem exatamente ao que foi registrado no `ac`.

| Role | `attendance:write` | `attendance:read` | `reports:read` | `users:*` | `devices:*` | `biometrics:*` |
|------|:---:|:---:|:---:|:---:|:---:|:---:|
| `admin` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `professor` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| `rh` | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `student` | ❌ | ✅ (próprio) | ❌ | ❌ | ❌ | ❌ |

> A camada de aplicação é responsável por restringir `student` ao próprio `member_id`. Dispositivos ESP32 não usam este sistema de roles.

A role é verificada via `currentUser` (injetado pelo `derive`). Rotas que exigem permissão devem usar o guard `requirePermission()` antes do handler.

---

## Injeção de Contexto via `derive`

O contexto de auth é injetado em todas as rotas protegidas via `.derive()` pelo `authPlugin`. O handler **nunca** chama `auth.api.getSession()` diretamente.

```typescript
// adapters/http/auth.plugin.ts — padrão de derive para rotas autenticadas
async ({ headers }) => {
  const session = await auth.api.getSession({ headers: headers as Record<string, string> });
  if (!session) throw new UnauthorizedError();
  return { currentUser: session.user, currentOrg: session.session.activeOrganizationId };
}
```

---

## Autenticação de Dispositivos IoT (ESP32)

Dispositivos ESP32 não usam sessões JWT. Autenticam via três headers obrigatórios.

### Headers obrigatórios (firmware ESP32)

| Header | Tipo | Descrição |
|--------|------|-----------|
| `X-Device-Token` | string | API key em plaintext — validada contra hash bcrypt |
| `X-Organization-Id` | UUID | UUID do tenant ao qual o device pertence |
| `X-Device-Id` | UUID | UUID do device — garante lookup determinístico em orgs com múltiplos ESP32 |

### Fluxo de validação (`deviceAuthPlugin`)

1. Extrai `X-Device-Token`, `X-Organization-Id` e `X-Device-Id` dos headers
2. Retorna `401 INVALID_DEVICE_TOKEN` se qualquer header estiver ausente
3. Busca o device ativo na tabela `devices` por `(organizationId, id, isActive = true)`
4. Compara o token recebido com o hash bcrypt via `Bun.password.verify()`
5. Se válido, injeta `authenticatedDevice` no contexto via `derive`
6. Se inválido: `401 INVALID_DEVICE_TOKEN` (sem distinguir "device não encontrado" de "token errado" — timing-safe)

### Segurança da chave

- A `apiKey` plaintext é exibida **apenas uma vez** no Portal Admin no momento do cadastro
- Somente o hash bcrypt é armazenado na coluna `api_key_hash` (Bun.password bcrypt)
- Rotação de chave gera novo hash — a chave antiga é imediatamente invalidada

---

## Proteção de Rotas

| Tipo de Rota | Plugin | Contexto Injetado |
|-------------|--------|-----------------|
| Rotas de utilizador | `authPlugin` | `currentUser`, `currentOrg` |
| Rotas de dispositivo | `deviceAuthPlugin` | `authenticatedDevice` |
| Rotas públicas | — | — |
| Rotas admin (`/v1/admin/`) | `authPlugin` + `requireRole('admin')` | `currentUser` |
