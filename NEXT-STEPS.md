# 🗺️ Próximos Passos — VULTRA API Core

> **Criado em:** Março 2026
> **Contexto:** O schema de domínio está completo (migrations `0001–0010`). Este documento descreve o que ainda precisa ser implementado no `apps/api-core`.

---

## 1. Configurar o Better Auth

O Better Auth gerencia suas próprias tabelas (usuários, sessões, organizações de auth, etc.) **no mesmo banco PostgreSQL** do projeto. Elas coexistem com as tabelas de negócio do Vultra.

### Passo a passo

#### 1.1 Instalar dependências

```bash
cd apps/api-core
bun add better-auth
```

#### 1.2 Criar `src/infrastructure/auth.ts`

Inicializar o Better Auth com os plugins do Vultra:

```typescript
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { organization, rbac, passkey, multiSession } from 'better-auth/plugins';
import { db } from './database/client';

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: 'pg' }),
  plugins: [
    organization({ allowUserToCreateOrganization: false }), // só super-admin
    rbac(),
    passkey(),
    multiSession({ maximumSessions: 3 }),
  ],
});
```

> Ver [docs/backend/manuais/autenticacao.md](docs/backend/manuais/autenticacao.md) para a matriz de permissões RBAC e o padrão de `derive`.

#### 1.3 Gerar e executar as migrations do Better Auth

O Better Auth usa seu **próprio CLI** para criar as tabelas no banco. As tabelas são criadas **no mesmo PostgreSQL** do Vultra, junto com as tabelas de negócio.

```bash
# Gerar o SQL das tabelas do Better Auth
bunx @better-auth/cli generate

# Aplicar no banco (ou usar o output SQL manualmente nas migrations Drizzle)
bunx @better-auth/cli migrate
```

**Tabelas criadas pelo Better Auth:**

| Tabela | Propósito |
|--------|-----------|
| `user` | Contas de login |
| `session` | Sessões web ativas |
| `account` | Credenciais OAuth / e-mail+senha |
| `verification` | Tokens de verificação de e-mail |
| `organization` | Orgs do plugin Organization (≠ `organizations` do domínio) |
| `member` | Vínculo user ↔ org do Better Auth (≠ `members` do domínio) |
| `invitation` | Convites para orgs |
| `passkey` | Chaves FIDO2 / WebAuthn |

> **Atenção:** as tabelas `organization` e `member` do Better Auth são **diferentes** das tabelas `organizations` e `members` do domínio Vultra. O campo `members.user_id` é o elo entre as duas camadas.

#### 1.4 Criar `src/infrastructure/auth-schema.ts` (opcional, para Drizzle query)

Se quiser usar o `db.query.*` do Drizzle nas tabelas do Better Auth, gere o schema Drizzle correspondente e exporte-o no barrel `schema/index.ts`.

---

## 2. Inicializar a aplicação ElysiaJS

Após configurar o auth, criar a estrutura base da API:

- [ ] `src/main.ts` — ponto de entrada com `Bun.serve` + instância do ElysiaJS
- [ ] `src/app.ts` — composição dos plugins e rotas
- [ ] `src/infrastructure/plugins/auth.plugin.ts` — wrappers de `derive` para `currentUser` / `currentOrg`
- [ ] `src/infrastructure/plugins/device-auth.plugin.ts` — middleware `X-Device-Token`
- [ ] `src/infrastructure/error-handler.ts` — handler global de erros (ver [docs/backend/manuais/error-handler.md](docs/backend/manuais/error-handler.md))

---

## 3. Implementar os módulos de domínio

Com a estrutura base pronta, implementar os módulos seguindo a arquitetura hexagonal:

- [ ] `members/` — CRUD de membros por tenant
- [ ] `devices/` — cadastro e rotação de `api_key` dos ESP32
- [ ] `biometric-profiles/` — enroll e revogação LGPD
- [ ] `attendance-sessions/` — abertura/encerramento de sessões
- [ ] `attendance-records/` — registro de presenças (consumer da fila Redis)
- [ ] `reports/` — relatórios de presença e bem-estar (RH)

---

## Referências

- [docs/backend/arquitetura/hexagonal.md](docs/backend/arquitetura/hexagonal.md)
- [docs/backend/manuais/autenticacao.md](docs/backend/manuais/autenticacao.md)
- [docs/backend/guias/typebox-rotas.md](docs/backend/guias/typebox-rotas.md)
- [docs/database/arquitetura/schema.md](docs/database/arquitetura/schema.md)
