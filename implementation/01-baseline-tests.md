# 01 - Baseline e Testes De Seguranca

## Objetivo

Criar ou ajustar testes que reproduzam os blockers antes dos fixes. Este modulo reduz risco de corrigir RBAC/RLS de forma parcial.

## Escopo

Arquivos provaveis:

- `apps/api-core/src/__tests__/routes/*`
- `apps/api-core/src/__tests__/use-cases/*`
- helpers de teste existentes no API Core

## Tarefas

1. Adicionar teste para `GET /v1/members/:id` bloqueando estudante que tenta acessar outro membro.
2. Adicionar teste para `GET /v1/members/:id` permitindo estudante acessar apenas seu proprio membro vinculado por `userId`.
3. Adicionar testes para `POST /v1/members`, `PATCH /v1/members/:id` e `DELETE /v1/members/:id` bloqueando professor.
4. Adicionar teste para `GET /v1/devices` bloqueando roles nao-admin.
5. Adicionar testes para rotas de presenca de usuario exigindo `attendance:write`.
6. Adicionar teste para `/v1/biometric/*` retornar 404 se a rota legada for removida.
7. Adicionar teste alternativo para `/v1/biometric/*` aplicar RBAC, rate limit e limite de payload se a rota legada for mantida.
8. Adicionar teste para relatorio de professor usar `members.id`, nao `auth user id`.
9. Adicionar teste para evitar status HTTP divergente em `INVALID_REPORT_RANGE`.

## Criterios De Aceite

- Os testes falham antes dos fixes quando executados contra o estado auditado.
- Os testes passam depois dos modulos 2, 3 e 4.
- Os testes nao usam `any` e nao dependem de ordem global entre casos.

## Verificacao

Comando principal:

```bash
bun test
```

Diretorio:

```bash
apps/api-core
```
