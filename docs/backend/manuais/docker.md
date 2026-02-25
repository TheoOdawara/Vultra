# 🐳 Docker — Configuração dos Serviços Backend

> **← [Voltar ao Backend](../README.md)**

---

## API Core (`api-core`)

**Imagem base:** `oven/bun:1.2-alpine`

O Dockerfile usa build **multi-stage** para minimizar o tamanho da imagem final:

| Stage | Ação |
|-------|------|
| `deps` | Instala dependências (`bun install --frozen-lockfile`) |
| `runner` | Copia apenas `node_modules` + `src/` — sem devDependencies |

No `docker-compose.yml`, o serviço `api-core`:
- Depende de `postgres` e `redis` (health check via `depends_on`)
- Expõe a porta `3000`
- Monta um volume para hot-reload em desenvolvimento (`./src:/app/src`)

---

## AI Service (`ai-service`)

**Imagem base:** `python:3.11-slim`

Pacotes de sistema instalados via `apt` (necessários para OpenCV e TensorFlow):
- `libgl1-mesa-glx`
- `libglib2.0-0`
- `libgomp1`

O `uv` é usado para instalar as dependências Python. O modelo ArcFace é **pré-baixado durante o `docker build`** para eliminar latência na primeira requisição em produção.

O serviço `ai-service` no `docker-compose.yml`:
- Depende de `redis`
- Expõe a porta `8000`
- Em produção com GPU: adicionar `deploy.resources.reservations.devices` para `nvidia`

---

## Ordem de Startup no `docker-compose.yml`

```
postgres  ──┐
             ├── api-core
redis     ──┤
             └── ai-service
```

---

## Comandos Comuns

```bash
# Subir todo o stack de desenvolvimento
docker compose up -d

# Rebuild após alterar Dockerfile ou dependências
docker compose build api-core
docker compose build ai-service

# Ver logs em tempo real
docker compose logs -f api-core
docker compose logs -f ai-service

# Rodar migrations
docker compose exec api-core bun run db:migrate
```
