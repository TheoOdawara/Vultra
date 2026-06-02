# 11 - Verificacao Final

## Objetivo

Validar que todos os fixes resolveram os achados consolidados e nao introduziram regressao.

## Checklist P0

- RLS/tenant context aplicado e testado.
- RBAC de membros corrigido.
- RBAC de devices corrigido.
- RBAC de presenca corrigido.
- Rota legada `/v1/biometric/*` removida ou protegida sem bypass.
- Relatorio de professor usa `members.id`.
- Operacoes sensiveis geram audit log.
- Fluxo de desativacao de membro trata biometria ou documenta endpoint separado de LGPD.

## Checklist P1

- Frontends chamam endpoints existentes.
- Live attendance nao depende de WS inexistente.
- Dashboards nao ficam publicos.
- Links de dashboard nao geram 404.
- Portais validam role, nao apenas sessao.
- Query keys incluem organizacao ou cache e limpo na troca de org.
- Frontends passam typecheck.
- Dockerfile do API Core builda.
- Compose exige secrets obrigatorios.
- AI Service builda e runtime acessa cache do modelo.

## Checklist P2

- Docs e tipos alinhados com implementacao.
- Governanca restaurada/migrada corretamente.
- ADRs aceitos tratados por errata/versionamento.
- Whitespace e line endings normalizados.

## Comandos De Verificacao

API Core:

```bash
bun install
bun test
bun run typecheck
```

Diretorio:

```bash
apps/api-core
```

Tipos compartilhados:

```bash
bun install
bun run typecheck
```

Diretorio:

```bash
packages/types
```

Frontends:

```bash
bun install
bun run typecheck
```

Diretorios:

```bash
apps/frontend-admin
apps/frontend-professores
apps/frontend-rh
```

AI Service:

```bash
python -m pytest -q apps/ai-service/tests/test_frame_validator.py apps/ai-service/tests/test_redis_worker.py
```

Repositorio:

```bash
git diff --check origin/main...HEAD
```

Infra:

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env config --quiet
docker build -f apps/api-core/Dockerfile apps/api-core
docker build -f apps/ai-service/Dockerfile apps/ai-service
```

## Criterio Final

O PR so deve sair de `changes requested` quando todos os checks P0 e P1 estiverem verdes. Qualquer P1 adiado precisa ter issue/follow-up explicito e nao pode afetar seguranca, LGPD, tenant isolation ou build basico.
