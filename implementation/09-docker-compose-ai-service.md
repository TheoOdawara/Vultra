# 09 - Docker, Compose e AI Service

## Objetivo

Corrigir build e boot reprodutivel da stack local/producao.

## Problemas Confirmados

- `apps/api-core/Dockerfile` copia `bun.lock`, mas `apps/api-core/bun.lock` nao existe.
- `docker compose -f infra/docker-compose.yml config --quiet` aceita secrets vazios com warnings.
- `apps/ai-service/Dockerfile` usa `uv pip install -e .` com projeto Python flat e Hatchling.
- Modelo InsightFace e baixado como root, mas runtime roda como `appuser`.

## Escopo

Arquivos provaveis:

- `apps/api-core/Dockerfile`
- `apps/api-core/.dockerignore`
- `apps/ai-service/Dockerfile`
- `apps/ai-service/pyproject.toml`
- `infra/docker-compose.yml`
- `infra/.env.example`
- `docs/backend/manuais/docker.md`

## Tarefas

1. Corrigir Dockerfile do API Core para usar lockfile real.
2. Opcao recomendada: versionar `apps/api-core/bun.lock` e manter `--frozen-lockfile`.
3. Alternativa: ajustar build para usar lockfile raiz/workspace se essa for a estrategia do repo.
4. Nao remover `--frozen-lockfile` sem decisao explicita, pois reduz reprodutibilidade.
5. Alterar `infra/docker-compose.yml` para exigir secrets com interpolacao obrigatoria:
   - `${POSTGRES_PASSWORD:?required}`
   - `${REDIS_PASSWORD:?required}`
   - `${BETTER_AUTH_SECRET:?required}`
6. Atualizar docs para usar `--env-file infra/.env` quando rodar Compose a partir da raiz.
7. Corrigir Dockerfile do AI Service para instalar dependencias sem build editable se o projeto continuar flat.
8. Alternativa: transformar AI Service em pacote Python real e configurar Hatchling corretamente.
9. Definir diretorio de cache InsightFace acessivel por `appuser`.
10. Baixar modelo no diretorio final e aplicar ownership correto.

## Criterios De Aceite

- Dockerfile do API Core builda sem lockfile ausente.
- Compose falha cedo se secrets obrigatorios estiverem ausentes.
- AI Service nao depende de rede em runtime para baixar modelo ja pre-carregado.
- `appuser` consegue ler o cache/modelo InsightFace.

## Verificacao

```bash
docker compose -f infra/docker-compose.yml --env-file infra/.env config --quiet
docker build -f apps/api-core/Dockerfile apps/api-core
docker build -f apps/ai-service/Dockerfile apps/ai-service
```
