# 05 - LGPD e Audit Logs

## Objetivo

Registrar operacoes sensiveis em audit logs e tratar biometria corretamente em fluxos de desativacao/exclusao.

## Problemas Confirmados

- Cadastro de device nao gera audit log.
- Rotacao de chave de device nao gera audit log.
- Desativacao de device nao gera audit log.
- Criacao, atualizacao e desativacao de membro nao geram audit log.
- Desativar membro nao coordena revogacao/anonymizacao de biometria.

## Escopo

Arquivos provaveis:

- `apps/api-core/src/core/use-cases/devices/*`
- `apps/api-core/src/core/use-cases/members/*`
- `apps/api-core/src/core/use-cases/biometrics/RevokeBiometricUseCase.ts`
- `apps/api-core/src/core/ports/IAuditLogRepository.ts`
- `apps/api-core/src/adapters/repositories/audit-log.repository.ts`
- rotas que instanciam use cases afetados

## Tarefas

1. Injetar `IAuditLogRepository` em `RegisterDeviceUseCase`.
2. Auditar `DEVICE_REGISTERED` sem incluir API key plaintext.
3. Injetar `IAuditLogRepository` em `RotateDeviceKeyUseCase`.
4. Auditar `DEVICE_KEY_ROTATED` sem incluir API key plaintext.
5. Injetar audit log no fluxo de desativacao de device.
6. Auditar `DEVICE_DEACTIVATED`.
7. Injetar audit log em `CreateMemberUseCase`.
8. Auditar `MEMBER_CREATED`.
9. Injetar audit log em `UpdateMemberUseCase`.
10. Auditar `MEMBER_UPDATED` com payload minimo e sem dados sensiveis desnecessarios.
11. Injetar audit log em `DeactivateMemberUseCase`.
12. Auditar `MEMBER_DEACTIVATED`.
13. Definir comportamento de LGPD para `DELETE /members/:id`:
    - recomendado: soft-delete do membro + revogacao de perfis biometricos ativos associados;
    - alternativa: deixar claro que esse endpoint nao implementa direito ao esquecimento e criar endpoint especifico.
14. Garantir que revogacao biometrica nullifica embedding e registra audit log.
15. Garantir que nenhum audit payload inclui `frameBase64`, embeddings ou API key plaintext.

## Decisao Recomendada

Para `DELETE /members/:id`, executar desativacao do membro e revogacao de biometria ativa associada, registrando ambos os eventos. Se houver exigencia de retencao diferente, criar endpoint separado para direito ao esquecimento LGPD.

## Criterios De Aceite

- Operacoes sensiveis sao auditaveis.
- API keys plaintext nunca sao persistidas nem logadas.
- Frames e embeddings nunca aparecem em audit logs ou respostas HTTP.
- Desativacao de membro nao deixa biometria ativa sem decisao explicita.

## Verificacao

```bash
bun test
bun run typecheck
```

Diretorio:

```bash
apps/api-core
```
