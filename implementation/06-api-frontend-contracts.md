# 06 - Contratos API/Frontend

## Objetivo

Alinhar clientes frontend, `@vultra/types`, docs e implementacao do API Core.

## Problemas Confirmados

- Professor frontend chama `DELETE /attendance/sessions/:id`, mas backend expoe `PATCH /attendance/sessions/:id/close`.
- Professor frontend abre WebSocket em `/v1/attendance/sessions/:sessionId/ws`, mas API Core nao tem WS.
- Admin frontend chama `GET /face`, mas backend expoe `GET /face/list`.
- Docs citam endpoint ESP32 errado: `/v1/attendance/device/record`; backend registra `/v1/attendance/record`.
- Docs citam rota manual diferente da rota real.

## Escopo

Arquivos provaveis:

- `apps/frontend-professores/src/lib/api.ts`
- `apps/frontend-professores/src/lib/websocket.ts`
- `apps/frontend-professores/src/components/chamada/*`
- `apps/frontend-admin/src/lib/api.ts`
- `packages/types/src/api/*.ts`
- `docs/backend/manuais/api-endpoints.md`
- `apps/api-core/src/adapters/http/routes/attendance.routes.ts`

## Tarefas

1. Trocar close session no professor frontend para `PATCH /attendance/sessions/:id/close`.
2. Trocar listagem de faces no admin frontend para `GET /face/list`.
3. Decidir estrategia para live attendance:
   - implementar WebSocket/SSE autenticado no API Core;
   - ou substituir por polling em endpoint existente/novo.
4. Recomendacao inicial: usar polling para reduzir escopo e risco neste PR.
5. Se polling for escolhido, remover ou desativar `useAttendanceWebSocket` e ajustar `LiveAttendancePanel`.
6. Se WS/SSE for escolhido, criar rota autenticada, com tenant context, RBAC e cleanup de conexoes.
7. Atualizar `@vultra/types` para rotas reais.
8. Atualizar docs para `/v1/attendance/record` no ESP32.
9. Atualizar docs para rota manual real: `/v1/attendance/sessions/:id/records/manual`.

## Criterios De Aceite

- Nenhum frontend chama endpoint inexistente.
- Tipos compartilhados representam os contratos reais.
- Docs e implementacao descrevem as mesmas rotas.
- Live attendance deixa de ser funcionalidade morta.

## Verificacao

```bash
bun run typecheck
```

Diretorios:

```bash
apps/frontend-admin
apps/frontend-professores
packages/types
```
