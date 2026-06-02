# 02 - RLS e Tenant Context

## Objetivo

Garantir que toda query tenant-aware execute com `app.current_org_id` setado dentro da mesma transacao usada pela query.

## Problemas Confirmados

- `withTenantContext()` existe, mas nao e usado nos repositorios.
- `withTenantContext()` executa `fn()` sem passar `tx`, entao mesmo se chamado, as queries podem ocorrer fora da transacao com `set_config`.
- Tabelas como `members`, `devices`, `attendance_sessions`, `attendance_records` e `biometric_profiles` usam RLS com `FORCE ROW LEVEL SECURITY`.

## Escopo

Arquivos provaveis:

- `apps/api-core/src/infrastructure/database/client.ts`
- `apps/api-core/src/adapters/repositories/member.repository.ts`
- `apps/api-core/src/adapters/repositories/device.repository.ts`
- `apps/api-core/src/adapters/repositories/reports.repository.ts`
- `apps/api-core/src/adapters/repositories/attendance.repository.ts`
- `apps/api-core/src/adapters/repositories/biometric.repository.ts`
- `apps/api-core/src/adapters/repositories/audit-log.repository.ts`
- `apps/api-core/src/adapters/http/middleware/auth.plugin.ts`
- `apps/api-core/src/adapters/http/middleware/device-auth.plugin.ts`

## Tarefas

1. Alterar `withTenantContext(database, organizationId, fn)` para executar `fn(tx)`.
2. Tipar o transaction client sem `any`.
3. Substituir queries tenant-aware para usar `tx`, nao `this.db`, dentro do tenant context.
4. Aplicar o padrao em `MemberRepository`.
5. Aplicar o padrao em `DeviceRepository`.
6. Aplicar o padrao em `ReportsRepository`.
7. Revisar e aplicar o padrao em `AttendanceRepository`.
8. Revisar e aplicar o padrao em `BiometricsRepository`.
9. Revisar `AuditLogRepository`: audit logs tambem tem `organization_id`, mas devem permanecer append-only.
10. Corrigir `authPlugin` se ele consultar membership em tabela protegida por RLS.
11. Corrigir `deviceAuthPlugin` para autenticar device com tenant context adequado ou com fluxo seguro que nao dependa de RLS quebrado.
12. Confirmar que nenhuma query tenant-aware le `organizationId` do body/query/params.

## Criterios De Aceite

- Toda query em tabela com `organization_id` tem filtro por `organization_id`.
- Toda query em tabela com RLS roda dentro de tenant context.
- `withTenantContext()` usa a mesma transacao que recebeu `set_config`.
- Nenhuma query nova usa prepared statements se isso quebrar `set_config`/RLS.

## Verificacao

```bash
bun test
bun run typecheck
```

Diretorio:

```bash
apps/api-core
```
