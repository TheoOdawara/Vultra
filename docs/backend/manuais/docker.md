# 🐳 Docker — Configuração dos Serviços Backend

> **← [Voltar ao Backend](../README.md)**

---

## Setup inicial

```bash
# 1. Copiar e preencher o arquivo de variáveis de ambiente
cp infra/.env.example infra/.env
# Edite infra/.env e defina os valores reais (POSTGRES_PASSWORD, REDIS_PASSWORD, BETTER_AUTH_SECRET)

# 2. Subir o stack completo
docker compose -f infra/docker-compose.yml --env-file infra/.env up -d

# 3. Executar as migrations do banco (apenas na primeira vez ou após novas migrations)
docker compose -f infra/docker-compose.yml --env-file infra/.env exec api-core bun run db:migrate
```

---

## API Core (`api-core`)

**Imagem base:** `oven/bun:1` (Bun com suporte nativo a TypeScript — sem etapa de compilação)

O Dockerfile usa build **multi-stage** para minimizar o tamanho da imagem final:

| Stage | Ação |
|-------|------|
| `install` | `bun install --frozen-lockfile` — instala dependências de produção |
| `release` | Copia `node_modules` + `src/` + arquivos de config, executa como usuário não-root |

No `docker-compose.yml`, o serviço `api-core`:
- Depende de `postgres` e `redis` (condição `service_healthy`)
- Expõe a porta `3000` (configurável via `API_CORE_PORT`)
- Injeta `DATABASE_URL` e `REDIS_URL` apontando para os hostnames internos dos containers
- Healthcheck: `GET /v1/health/ai-service`

### Variáveis de ambiente obrigatórias

| Variável | Exemplo | Descrição |
|----------|---------|-----------|
| `DATABASE_URL` | `postgresql://vultra:secret@postgres:5432/vultra_db` | Conexão PostgreSQL (hostname = `postgres`) |
| `REDIS_URL` | `redis://:secret@redis:6379` | Conexão Redis (hostname = `redis`) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | Segredo de assinatura de sessão (mín. 32 chars) |
| `BETTER_AUTH_URL` | `http://localhost:3000` | URL pública da API (usado em links de e-mail) |
| `PORT` | `3000` | Porta de escuta interna |

---

## AI Service (`ai-service`)

**Imagem base:** `python:3.11-slim`

Pacotes de sistema instalados via `apt` (necessários para OpenCV e InsightFace):
- `libgl1-mesa-glx`
- `libglib2.0-0`
- `libgomp1`

O `uv` é usado para instalar as dependências Python. O modelo ArcFace **buffalo_l é pré-baixado durante o `docker build`** (no `~/.insightface/models/`) para eliminar latência no cold-start em produção.

> ⚠️ **GPU**: para habilitar CUDA, adicione `deploy.resources.reservations.devices` com `driver: nvidia` no serviço `ai-service` do compose.

O serviço `ai-service` no `docker-compose.yml`:
- Depende de `redis` (condição `service_healthy`)
- Expõe a porta `8000` (configurável via `AI_SERVICE_PORT`)
- Healthcheck: `GET /health` com `start_period: 60s` (tempo para carregar InsightFace)

---

## PostgreSQL + pgvector

**Imagem:** `pgvector/pgvector:pg16`

O pgvector já vem habilitado na imagem. As migrations do Drizzle habilitam a extensão via `CREATE EXTENSION IF NOT EXISTS vector`.

---

## Ordem de Startup

```
postgres  ──┐
             ├── api-core
redis     ──┤
             └── ai-service
```

`api-core` e `ai-service` só iniciam após `postgres` e `redis` passarem no healthcheck.

---

## Comandos Comuns

```bash
# Referência ao compose (abreviar com alias ou rodar da raiz)
COMPOSE="docker compose -f infra/docker-compose.yml --env-file infra/.env"

# Subir todo o stack
$COMPOSE up -d

# Subir apenas infraestrutura (banco + cache)
$COMPOSE up -d postgres redis

# Rebuild após alterar Dockerfile ou dependências
$COMPOSE build api-core
$COMPOSE build ai-service

# Ver logs em tempo real
$COMPOSE logs -f api-core
$COMPOSE logs -f ai-service

# Executar migrations (primeira vez ou após novas migrations)
$COMPOSE exec api-core bun run db:migrate

# Abrir o Drizzle Studio
$COMPOSE exec api-core bun run db:studio

# Parar e remover containers + volumes (DESTRUTIVO — apaga dados locais)
$COMPOSE down -v
```

---

## Troubleshooting

| Problema | Causa | Solução |
|----------|-------|---------|
| `api-core` não inicia | `postgres` não passou no healthcheck ainda | Aguardar ou rodar `$COMPOSE ps` para ver status |
| `BETTER_AUTH_SECRET` inválido | Secret menor que 32 caracteres | Gerar com `openssl rand -base64 32` |
| `ai-service` demora para ficar `healthy` | Download/load do modelo InsightFace (~60s) | Normal — aguardar o `start_period` |
| Migrations falham | Banco não existe ou já está na versão | Verificar `DATABASE_URL` e estado da migration |
