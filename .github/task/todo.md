# TODO — Plano Ativo

> Branch: `feat(database)/full-database-schema`
> Data: 2026-03-14
> Objetivo: Bootstrap ElysiaJS — esqueleto funcional da API

## Fase 5 — Bootstrap ElysiaJS

### Core Domain
- [x] Criar `src/core/domain/errors/DomainError.ts` — classe base abstrata (errorCode, httpStatus, message)

### Infrastructure
- [x] Criar `src/infrastructure/error-handler.ts` — plugin .onError() global
- [x] Criar `src/infrastructure/plugins/auth.plugin.ts` — `.derive()` para currentUser + currentOrg
- [x] Criar `src/infrastructure/plugins/device-auth.plugin.ts` — `.derive()` para X-Device-Token + Bun.password.verify()

### Aplicação
- [x] Criar `src/app.ts` — composição ElysiaJS: globalErrorHandler → CORS → auth routes → /v1 routes
- [x] Criar `src/index.ts` — entry point: app.listen(port)

### Verificação
- [x] `bun run typecheck` — zero erros ✅
- [x] `bun --hot src/index.ts` inicia sem erros ✅
- [x] `GET /api/auth/ok` → `{ ok: true }` ✅