# ⚙️ Configuração — Variáveis de Ambiente

> **← [Voltar ao Backend](../README.md)**

---

## API Core (`api-core`)

Arquivo: `apps/api-core/.env` (copiar de `.env.example`). Todas as variáveis abaixo são obrigatórias em produção.

| Variável | Exemplo | Descrição |
|----------|---------|-----------|
| `DATABASE_URL` | `postgresql://vultra:secret@postgres:5432/vultra_db` | Connection string PostgreSQL |
| `REDIS_URL` | `redis://:secret@redis:6379` | Connection string Redis (incluir senha) |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` | Segredo para assinatura de sessões (mín. 32 chars) |
| `BETTER_AUTH_URL` | `http://localhost:3000` | URL base da API (para links em e-mails, OAuth callbacks) |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `https://admin.vultra.app,https://rh.vultra.app` | CSV de origens permitidas no CORS e `trustedOrigins` do Better Auth |
| `PORT` | `3000` | Porta do servidor ElysiaJS (padrão: `3000`) |
| `NODE_ENV` | `production` | Ativa otimizações e desativa logs verbose |

> Em Docker Compose, `DATABASE_URL` e `REDIS_URL` devem usar os hostnames dos containers (`postgres`, `redis`), não `localhost`.

---

## AI Service (`ai-service`)

Arquivo: variáveis de ambiente injetadas via Docker Compose ou `.env`. Gerenciadas via `pydantic-settings` (`config.py`).

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `REDIS_URL` | `redis://localhost:6379` | Conexão com o Redis (incluir senha: `redis://:pass@host:port`) |
| `AI_QUEUE_NAME` | `ai:recognition:queue` | Nome da fila Redis (LPUSH/BLPOP) |
| `AI_RESULT_PREFIX` | `ai:recognition:result:` | Prefixo das chaves de resultado no Redis |
| `MODEL_NAME` | `buffalo_l` | InsightFace model pack — ver [guias/modelos-ia.md](../guias/modelos-ia.md) |
| `MAX_PAYLOAD_BYTES` | `1048576` (1 MB) | Tamanho máximo do frame em bytes |
| `JOB_TIMEOUT_S` | `3.0` | Timeout máximo para processar um job (segundos) |
| `RESULT_TTL_S` | `60` | TTL do resultado no Redis (segundos) |
| `DEBUG` | `false` | `true` = habilita Swagger UI (`/docs`) e logs detalhados |
| `HOST` | `0.0.0.0` | Endereço de bind do Uvicorn |
| `PORT` | `8000` | Porta do servidor Uvicorn |

> **Atenção:** Alterar `MODEL_NAME` requer análise prévia de compatibilidade de embeddings.  
> Veja [database/arquitetura/versionamento-embeddings.md](../../database/arquitetura/versionamento-embeddings.md).

---

## Dependências Python (AI Service)

Gerenciadas via `pyproject.toml` com `uv` como gestor de pacotes. Linter: `ruff`.

| Pacote | Versão mínima | Finalidade |
|--------|--------------|------------|
| `fastapi` | 0.115+ | Framework HTTP |
| `uvicorn[standard]` | 0.34+ | Servidor ASGI |
| `insightface` | 0.7.3+ | Engine de reconhecimento facial (RetinaFace + ArcFace) |
| `onnxruntime` | 1.17+ | Backend de inferência ONNX (CPU; use `onnxruntime-gpu` para CUDA) |
| `redis` | 5.2+ | Cliente async para filas |
| `opencv-python-headless` | 4.10+ | Processamento de imagem sem GUI |
| `numpy` | 1.26+ | Arrays (embeddings, BGR frames) |
| `pillow` | 11.0+ | Decode de imagens em memória |
| `pydantic` + `pydantic-settings` | 2.x | Schemas e config via env vars |
