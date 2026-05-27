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

- [x] `src/main.ts` — ponto de entrada com `Bun.serve` + instância do ElysiaJS (completo)
- [x] `src/infrastructure/server.ts` — composição dos plugins e rotas (refatorado)
- [x] `src/adapters/http/auth.plugin.ts` — wrappers de `derive` para `currentUser` / `currentOrg` (refatorado)
- [x] `src/adapters/http/device-auth.plugin.ts` — middleware `X-Device-Token` (refatorado)
- [x] `src/infrastructure/error-handler.ts` — handler global de erros (ver [docs/backend/manuais/error-handler.md](docs/backend/manuais/error-handler.md))

---

## 3. Implementar os módulos de domínio

Com a estrutura base pronta, implementar os módulos seguindo a arquitetura hexagonal:

- [x] `members/` — CRUD de membros por tenant (port + repo + 5 use cases + rotas + 15 testes)
- [x] `devices/` — cadastro e rotação de `api_key` dos ESP32 (port + repo + 5 use cases + rotas + 13 testes)
- [x] `biometric-profiles/` — enroll e revogação LGPD (port + repo + 4 use cases + rotas + 17 testes)
- [x] `attendance-sessions/` — abertura/encerramento de sessões (port + repo + use cases + rotas + 21 testes)
- [x] `attendance-records/` — registro de presenças (consumer da fila Redis) — integrado em `attendance/`
- [x] `reports/` — relatórios de presença e bem-estar (port + repo SQL raw + 2 use cases + rotas)

## 4. Infraestrutura e Frontend (status atual)

- [x] **Docker Compose** — PostgreSQL 16, Redis 7, AI Service, API Core (`infra/docker-compose.yml`)
- [x] **`packages/types`** — contrato TypeScript compartilhado entre API e frontends (`@vultra/types`)
- [x] **Frontend Admin** — Next.js 15 + TanStack Query: login, membros (CRUD), dispositivos (registro + rotação de chave), relatórios de presença, health monitor (`apps/frontend-admin/`)
- [x] **Frontend Professores** — chamada em tempo real (WebSocket), registro manual, relatórios por turma (`apps/frontend-professores/`)
- [x] **Frontend RH** — presença e wellbeing dashboard com alertas LGPD-compliant (`apps/frontend-rh/`)

## 5. Próximas etapas pendentes

- [ ] **Testes de integração** — contra banco real (migrations + seed + stack Docker)
- [ ] **Firmware (ESP32-CAM)** — implementação C++/Arduino com autenticação X-Device-Token e envio de frames JPEG (`firmware/esp32-cam/`)
- [ ] **Install npm deps nos frontends** — `cd apps/frontend-admin && npm install` (e idem para professores/rh)
- [ ] **Shadcn/UI CLI** — `npx shadcn@latest init` em cada portal para instalar os primitivos (`Button`, `Table`, `Dialog`, `Badge`, `AlertDialog`)
- [ ] **WebSocket no API Core** — implementar endpoint `GET /v1/attendance/sessions/:id/ws` para o LiveAttendancePanel
- [ ] **Exportação de relatórios (RH)** — PDF/XLSX a partir dos dados do wellbeing e attendance report

---

## Referências

- [docs/backend/arquitetura/hexagonal.md](docs/backend/arquitetura/hexagonal.md)
- [docs/backend/manuais/autenticacao.md](docs/backend/manuais/autenticacao.md)
- [docs/backend/guias/typebox-rotas.md](docs/backend/guias/typebox-rotas.md)
- [docs/database/arquitetura/schema.md](docs/database/arquitetura/schema.md)
