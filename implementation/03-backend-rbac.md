# 03 - RBAC Backend

## Objetivo

Remover escaladas de permissao em membros, devices, presenca e biometria.

## Problemas Confirmados

- `GET /members` usa `attendance:read`.
- `POST/PATCH/DELETE /members` usam `attendance:write`, permitindo professor mutar membros.
- `GET /members/:id` usa `isSelf = currentUser?.id !== undefined`, que e um no-op depois do `authPlugin`.
- `GET /devices` usa `attendance:read`, permitindo roles nao-admin listarem devices.
- Rotas de presenca de usuario nao tem RBAC.
- Rota legada `/v1/biometric/*` continua ativa sem os guards de `/v1/face/*`.

## Escopo

Arquivos provaveis:

- `apps/api-core/src/infrastructure/auth.ts`
- `apps/api-core/src/adapters/http/routes/members.routes.ts`
- `apps/api-core/src/adapters/http/routes/devices.routes.ts`
- `apps/api-core/src/adapters/http/routes/attendance.routes.ts`
- `apps/api-core/src/adapters/http/routes/biometric.routes.ts`
- `apps/api-core/src/adapters/http/routes/face.routes.ts`
- `apps/api-core/src/infrastructure/server.ts`

## Tarefas

1. Adicionar permissoes explicitas `members:read` e `members:manage` na matriz RBAC.
2. Definir matriz recomendada:
   - `admin`: `members:read`, `members:manage`, `devices:manage`, `attendance:write`, `attendance:read`, `reports:read`, `biometrics:*`.
   - `professor`: `members:read` se necessario para chamada, `attendance:write`, `attendance:read`, biometria apenas se for regra de produto.
   - `rh`: `members:read`, `attendance:read`, `reports:read`, biometria apenas list/verify se for regra de produto.
   - `student`: sem listagem geral; self-access apenas por comparacao com `member.userId`.
3. Corrigir `GET /members` para exigir `members:read` e avaliar se estudantes devem ser bloqueados da listagem.
4. Corrigir `GET /members/:id` para buscar o membro e comparar `member.userId === currentUser.id` quando a role nao puder ler todos.
5. Corrigir `POST/PATCH/DELETE /members` para exigir `members:manage`.
6. Corrigir `GET /devices` para exigir `devices:manage`.
7. Adicionar `attendance:write` nas rotas:
   - `POST /v1/attendance/sessions`
   - `PATCH /v1/attendance/sessions/:id/close`
   - `POST /v1/attendance/sessions/:id/records/manual`
8. Remover `professorId` livre do body ou validar que professor so pode abrir sessao para o proprio `members.id`.
9. Remover `biometricRoutes` do `server.ts`, recomendado.
10. Se a rota legada for mantida, aplicar exatamente os mesmos guards de `face.routes.ts`: RBAC, rate limit, limite de payload, auditoria com IP e schemas estritos.

## Decisao Recomendada

Remover `/v1/biometric/*`, pois docs e `@vultra/types` ja tratam `/v1/face/*` como superficie canonica e `/v1/biometric/*` como legado 404.

## Criterios De Aceite

- Professor nao cria, edita ou desativa membros.
- Estudante nao lista membros e nao acessa outro membro por ID.
- Roles nao-admin nao listam devices.
- Rotas de presenca de usuario exigem permissao explicita.
- `/v1/biometric/*` nao permanece como bypass de `/v1/face/*`.

## Verificacao

```bash
bun test
bun run typecheck
```

Diretorio:

```bash
apps/api-core
```
