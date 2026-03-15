# ⚙️ Configuração — Variáveis de Ambiente

> **← [Voltar ao Backend](../README.md)**

---

## API Core (`api-core`)

Arquivo: `.env` na raiz do serviço. Todas as variáveis abaixo são obrigatórias em produção.

| Variável | Exemplo | Descrição |
|----------|---------|-----------|
| `DATABASE_URL` | `postgres://user:pass@postgres:5432/vultra` | Connection string PostgreSQL |
| `REDIS_URL` | `redis://redis:6379` | Connection string Redis |
| `BETTER_AUTH_SECRET` | `<string aleatória 64 bytes>` | Segredo para assinatura de tokens JWT |
| `BETTER_AUTH_URL` | `http://localhost:3000` | URL base da API (para callbacks OAuth) |
| `BETTER_AUTH_TRUSTED_ORIGINS` | `https://admin.vultra.app,https://rh.vultra.app` | CSV de origens permitidas no CORS e `trustedOrigins` do Better Auth |
| `PORT` | `3000` | Porta do servidor ElysiaJS (default: `3000`) |
| `NODE_ENV` | `production` | Ativa otimizações e desativa logs verbose |

> Gerar `BETTER_AUTH_SECRET` com: `openssl rand -base64 64`

---

## AI Service (`ai-service`)

Arquivo: `.env` na raiz do serviço. Gerenciado via `pydantic-settings`.

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `REDIS_URL` | `redis://redis:6379` | Conexão com o Redis |
| `DEEPFACE_MODEL` | `ArcFace` | Modelo de embedding — ver [guias/modelos-ia.md](../guias/modelos-ia.md) |
| `DETECTOR_BACKEND` | `retinaface` | Detector de face (`retinaface` \| `mtcnn` \| `opencv`) |
| `DEBUG` | `false` | Habilita Swagger UI e logs detalhados |
| `PORT` | `8000` | Porta do servidor Uvicorn |
| `WORKERS` | `1` | Número de workers Uvicorn — manter `1` com GPU compartilhada |

> **Atenção:** Alterar `DEEPFACE_MODEL` requer análise prévia de compatibilidade de embeddings.  
> Veja [database/arquitetura/versionamento-embeddings.md](../../database/arquitetura/versionamento-embeddings.md).

---

## Dependências Python (AI Service)

Gerenciadas via `pyproject.toml` com `uv` como gestor de pacotes. Linter: `ruff`.

| Pacote | Versão mínima | Finalidade |
|--------|--------------|------------|
| `fastapi` | 0.115+ | Framework HTTP |
| `uvicorn[standard]` | 0.34+ | Servidor ASGI |
| `deepface` | 0.0.93+ | Engine de reconhecimento e sentimento |
| `redis` | 5.2+ | Cliente async para filas |
| `tensorflow` | 2.18+ | Backend do modelo ArcFace |
| `opencv-python-headless` | 4.10+ | Processamento de imagem sem GUI |
| `numpy` | 2.1+ | Arrays (embeddings) |
| `pillow` | 11.0+ | Decode de imagens em memória |
| `pydantic` + `pydantic-settings` | 2.x | Schemas e config via env vars |
