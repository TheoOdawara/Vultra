# 🔄 Protocolo de Fila Redis — API Core ↔ AI Service

> **← [Voltar ao Backend](../README.md)**

A comunicação entre a **API Core (Bun)** e o **AI Service (Python)** é feita via filas Redis para garantir escalabilidade e resiliência. Para PoC locais (ex.: câmera do computador) pode ser utilizada comunicação HTTP síncrona direta (`POST /process-image`); a arquitetura de produção e integração com ESP32 deve usar filas + Circuit Breaker.

---

## Canais

| Canal | Direção | Produtor | Consumidor |
|-------|---------|----------|------------|
| `ai:recognition:queue` | API → IA | API Core (Bun) — `LPUSH` | AI Service (Python) — `BLPOP` |
| `ai:recognition:result:{jobId}` | IA → API | AI Service (Python) — `SETEX` | API Core (Bun) — polling `GET` |

- A API Core usa **LPUSH** para enfileirar jobs.
- O AI Service usa **BLPOP** com timeout de **2s** para consumir (sem busy-loop).
- O resultado é publicado via **SETEX** com TTL de **60 segundos**. Jobs não consumidos dentro desse prazo são descartados.
- Após consumir o resultado, a API Core remove a chave com `DEL` (resultado é one-shot).

---

## Mensagem: Job (API Core → AI Service)

Schema Pydantic: `AIJob` em `apps/ai-service/schemas/job_schemas.py`

| Campo | Tipo | Notas |
|-------|------|-------|
| `job_id` | `string` (UUID) | Identificador único do job — gerado pela API Core com `createId()` |
| `frame_base64` | `string` | Frame JPEG em base64 — **NUNCA logar ou persistir** (LGPD) |
| `organization_id` | `string` | UUID do tenant — isolamento obrigatório |
| `device_id` | `string \| null` | UUID do ESP32-CAM, quando aplicável |

**Exemplo:**
```json
{
  "job_id": "abc123",
  "frame_base64": "<base64>",
  "organization_id": "org-uuid",
  "device_id": "device-uuid"
}
```

---

## Mensagem: Resultado (AI Service → API Core)

Schema Pydantic: `AIResult` em `apps/ai-service/schemas/job_schemas.py`

| Campo | Tipo | Notas |
|-------|------|-------|
| `job_id` | `string` | Referência ao job original |
| `embedding` | `number[] (512)` \| `null` | ArcFace embedding — `null` se `error` estiver preenchido |
| `quality_score` | `number [0,1]` \| `null` | Score de qualidade do frame — `null` em caso de erro |
| `processing_ms` | `number` | Tempo total de processamento em ms |
| `error` | `string \| null` | Código de erro estruturado (ver tabela abaixo) |

**Códigos de erro:**

| Código | Significado |
|--------|-------------|
| `NO_FACE_DETECTED` | Nenhuma face detectada no frame |
| `MULTIPLE_FACES` | Mais de uma face detectada (exatamente 1 é obrigatório) |
| `LOW_QUALITY` | Frame rejeitado por score de qualidade abaixo do mínimo |
| `INVALID_BASE64` | Payload não é base64 válido |
| `INVALID_IMAGE` | Bytes não formam uma imagem válida |
| `FRAME_TOO_LARGE` | Payload acima de `MAX_PAYLOAD_BYTES` (padrão: 1 MB) |
| `PROCESSING_TIMEOUT` | Processamento excedeu `JOB_TIMEOUT_S` |
| `INTERNAL_ERROR` | Erro inesperado no AI Service |

---

## Diagrama de Sequência

```
API Core (Bun)                Redis                 AI Service (Python)
     │                          │                          │
     │── LPUSH ai:recognition:queue ──▶│                   │
     │                          │◀── BLPOP (timeout=2s) ───│
     │                          │───── job JSON ────────────▶│
     │                          │            RetinaFace detect│
     │                          │            ArcFace embed    │
     │                          │            (RAM-only)       │
     │                          │◀── SETEX result:{jobId} ───│
     │◀── GET result:{jobId} ───│                          │
     │   (poll cada 50ms)       │                          │
     │── DEL result:{jobId} ───▶│                          │
     │                          │                          │
```

---

## Timeout e Resiliência

| Parâmetro | Valor |
|-----------|-------|
| Timeout de espera da API Core | `3000ms` |
| Polling interval | `50ms` |
| TTL do resultado no Redis | `60s` |
| BLPOP timeout no AI Service | `2s` |

Se o resultado não chegar dentro de 3s, a API Core lança `AIJobTimeoutError` e registra uma falha no Circuit Breaker. Após 5 falhas consecutivas o circuito abre (ver [circuit-breaker.md](./circuit-breaker.md)).
