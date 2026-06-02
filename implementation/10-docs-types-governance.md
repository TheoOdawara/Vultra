# 10 - Docs, Tipos e Governanca

## Objetivo

Remover drift entre documentacao, tipos e implementacao, alem de restaurar governanca critica removida pelo PR.

## Problemas Confirmados

- `.github/copilot-instructions.md` foi removido.
- `.github/tasks/*` foram removidos.
- `.opencode/instructions.md` e generico e nao preserva regras especificas do Vultra.
- Nao ha `opencode.json` apontando para `.opencode/instructions.md`.
- Docs/tipos dizem que `/v1/biometric/*` e 404, mas a rota esta registrada.
- Docs de health nao correspondem ao schema real.
- Docs de ESP32 apontam endpoint errado.
- ADRs aceitos foram editados diretamente.
- `git diff --check` falha por whitespace/CRLF.

## Escopo

Arquivos provaveis:

- `.github/copilot-instructions.md`
- `.github/tasks/*`
- `.opencode/instructions.md`
- `opencode.json`
- `docs/backend/manuais/api-endpoints.md`
- `docs/backend/guias/typebox-rotas.md`
- `docs/backend/manuais/docker.md`
- `packages/types/src/api/face.ts`
- `packages/types/src/api/health.ts`
- `docs/backend/adrs/*`

## Tarefas

1. Restaurar instrucoes canonicas removidas ou migrar integralmente para OpenCode.
2. Se migrar para OpenCode, criar `opencode.json` com `instructions` apontando para o arquivo correto.
3. Garantir que regras especificas do Vultra permanecam documentadas:
   - TypeBox obrigatorio;
   - Zod/Joi/Yup proibidos;
   - RLS e tenant context obrigatorios;
   - nenhuma imagem biometrica persistida;
   - audit logs para operacoes sensiveis;
   - migrations SQL manuais;
   - Better Auth/RBAC por role.
4. Corrigir docs e tipos para `/v1/biometric/*` conforme decisao do modulo 3.
5. Atualizar docs de health para `status`, `circuitState`, `failureCount`, `lastFailureAt`.
6. Atualizar docs de ESP32 para `/v1/attendance/record`.
7. Atualizar docs de presenca manual para `/v1/attendance/sessions/:id/records/manual`.
8. Reverter edicoes diretas em ADRs aceitos ou mover erratas para ADR/errata versionada nova.
9. Normalizar line endings para LF.
10. Remover trailing whitespace.

## Criterios De Aceite

- Docs, tipos e implementacao descrevem a mesma API.
- Governanca especifica do Vultra nao fica substituida por instrucoes genericas.
- ADRs aceitos nao sao alterados diretamente sem errata/versionamento.
- `git diff --check origin/main...HEAD` passa.

## Verificacao

```bash
git diff --check origin/main...HEAD
bun run typecheck
```

Diretorio adicional:

```bash
packages/types
```
