# Plano de Implementacao Pos-Auditoria

Este diretorio organiza a execucao dos fixes resultantes da consolidacao de `AUDIT.md` e `AUDIT-claudin.md`.

Objetivo: corrigir os blockers do PR #12 em ordem logica, modular e verificavel, priorizando isolamento multitenant, RBAC, LGPD, contratos API/frontend e confiabilidade de build.

## Ordem Recomendada

| Ordem | Modulo | Prioridade | Arquivo |
|---|---|---:|---|
| 1 | Baseline e testes de seguranca | P0 | [01-baseline-tests.md](./01-baseline-tests.md) |
| 2 | RLS e tenant context | P0 | [02-rls-tenant-context.md](./02-rls-tenant-context.md) |
| 3 | RBAC backend | P0 | [03-backend-rbac.md](./03-backend-rbac.md) |
| 4 | Reports e identidade professor | P0 | [04-reports-professor-identity.md](./04-reports-professor-identity.md) |
| 5 | LGPD e audit logs | P0 | [05-lgpd-audit-logs.md](./05-lgpd-audit-logs.md) |
| 6 | Contratos API/frontend | P1 | [06-api-frontend-contracts.md](./06-api-frontend-contracts.md) |
| 7 | Frontend routing, auth e cache tenant | P1 | [07-frontend-routing-auth-cache.md](./07-frontend-routing-auth-cache.md) |
| 8 | Typecheck e dependencias frontend | P1 | [08-frontend-typecheck-dependencies.md](./08-frontend-typecheck-dependencies.md) |
| 9 | Docker, Compose e AI Service | P1 | [09-docker-compose-ai-service.md](./09-docker-compose-ai-service.md) |
| 10 | Docs, tipos e governanca | P2 | [10-docs-types-governance.md](./10-docs-types-governance.md) |
| 11 | Verificacao final | P0 | [11-final-verification.md](./11-final-verification.md) |

## Regra De Execucao

Execute os modulos em ordem. Nao avance para um modulo posterior se um P0 anterior ainda estiver quebrado, exceto para criar testes que demonstrem a falha.

Cada modulo deve terminar com:

- testes relevantes passando, quando existirem;
- typecheck sem novas falhas no pacote alterado;
- contratos docs/tipos/implementacao alinhados quando o modulo tocar API;
- nenhum segredo, token, frame biometrico ou embedding em logs, payloads de auditoria ou respostas HTTP.

## Criterio De Merge

O PR so deve ser considerado mergeavel quando:

- todos os modulos P0 estiverem completos;
- todos os modulos P1 estiverem completos ou explicitamente transformados em follow-up aceito;
- `git diff --check origin/main...HEAD` passar;
- `apps/api-core`, `packages/types` e os tres frontends passarem em typecheck;
- testes do API Core e AI Service passarem no ambiente com dependencias instaladas;
- Docker/Compose nao aceitarem secrets vazios silenciosamente.
