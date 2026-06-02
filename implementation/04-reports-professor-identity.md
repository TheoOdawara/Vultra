# 04 - Reports e Identidade Professor

## Objetivo

Corrigir o escopo de relatorios por professor usando a identidade correta: `members.id`, nao `auth user id`.

## Problemas Confirmados

- `attendance_sessions.professor_id` representa UUID do membro professor.
- `reports.routes.ts` usa `currentUser.id` do Better Auth como `professorId`.
- Isso pode gerar relatorios vazios, incorretos ou inconsistentes para professores.
- `InvalidReportRangeError` existe duplicado com HTTP status divergente.

## Escopo

Arquivos provaveis:

- `apps/api-core/src/adapters/http/routes/reports.routes.ts`
- `apps/api-core/src/adapters/repositories/member.repository.ts`
- `apps/api-core/src/core/ports/IMemberRepository.ts`
- `apps/api-core/src/core/use-cases/reports/GetAttendanceReportUseCase.ts`
- `apps/api-core/src/core/use-cases/reports/GetWellbeingReportUseCase.ts`
- `apps/api-core/src/core/domain/errors/DomainError.ts`

## Tarefas

1. Criar metodo de repositorio para resolver membro por `userId + organizationId`.
2. Usar esse metodo em `reports.routes.ts` para converter `currentUser.id` em `members.id`.
3. Quando role for `professor` e nao tiver `reports:read`, ignorar `query.professorId` e usar apenas o membro resolvido.
4. Se nao houver membro vinculado ao usuario professor, retornar `ForbiddenError` ou erro de dominio explicito.
5. Consolidar `InvalidReportRangeError` em `DomainError.ts`.
6. Remover a classe duplicada de `GetAttendanceReportUseCase.ts`.
7. Atualizar `GetWellbeingReportUseCase.ts` para importar o erro canonico.
8. Garantir que `INVALID_REPORT_RANGE` sempre retorne o mesmo HTTP status.

## Criterios De Aceite

- Professor nao consegue consultar relatorio de outro professor.
- Professor usa `members.id` no filtro `attendance_sessions.professor_id`.
- Admin/RH continuam podendo filtrar por `query.professorId`.
- `INVALID_REPORT_RANGE` tem um unico status HTTP.

## Verificacao

```bash
bun test
bun run typecheck
```

Diretorio:

```bash
apps/api-core
```
