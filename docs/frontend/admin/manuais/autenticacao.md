# 🔐 Autenticação no Portal Admin

> **← [Voltar ao Admin](../README.md)**

---

## Cliente Better Auth

Inicializado em `lib/auth-client.ts` com os plugins:
- `organizationClient()` — acesso a métodos de organização (trocar tenant, listar membros)
- `passkeyClient()` — suporte a autenticação biométrica WebAuthn

Hooks exportados usados nos layouts:

| Hook | Uso |
|------|-----|
| `useSession()` | Contexto do usuário autenticado. Redireciona para `/login` se sem sessão |
| `useActiveOrganization()` | Organização ativa. Usado para injetar `organizationId` nas queries |

---

## Proteção de Rotas (Middleware Next.js)

O `middleware.ts` valida a sessão server-side via `betterFetch` em cada request para rotas do grupo `(dashboard)`.

| Rota | Requisito |
|------|-----------|
| `/organizations/*` | `role === 'super_admin'` |
| `/(dashboard)/*` | Qualquer sessão válida |
| `/(auth)/*` | Sem sessão (redireciona logados para dashboard) |

> O Super Admin tem uma view especial no módulo `organizations/` com seletor de tenant. Org Admins nunca veem dados de outros tenants.

---

## Padrão de Componente de Tabela

Tabelas de listagem usam **TanStack Table** com `useQuery` do TanStack Query. O `organizationId` é sempre extraído de `useActiveOrganization()` — nunca de URL params ou estado global sem validação.

A `queryKey` inclui o `organizationId` para garantir invalidação correta de cache ao trocar de organização:

```typescript
// Padrão de query key — sempre inclui organizationId
useQuery({
  queryKey: ['members', organizationId],
  queryFn: () => api.get(`/v1/members?orgId=${organizationId}`),
})
```
