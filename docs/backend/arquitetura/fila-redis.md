# 🔄 Protocolo de Fila Redis — API Core ↔ AI Service

> **← [Voltar ao Backend](../README.md)**

A comunicação entre a **API Core (Bun)** e o **AI Service (Python)** é, em produção, feita via filas Redis para garantir escalabilidade e resiliência. Para PoC locais (ex.: câmera do computador) pode ser utilizada comunicação HTTP síncrona direta; no entanto, a arquitetura de produção deve privilegiar filas Redis e Circuit Breaker.

---

## Canais

| Canal | Direção | Produtor | Consumidor |
|-------|---------|----------|------------|
| `vultra:queue:embedding` | API → IA | API Core (Bun) | AI Service (Python) |
| `vultra:result:{jobId}` | IA → API | AI Service (Python) | API Core (Bun) |

- A API Core usa **LPUSH** para enfileirar jobs.
- O AI Service usa **BLPOP** com timeout de 5s para consumir (sem busy-loop).
- O resultado é publicado via **SETEX** com TTL de **60 segundos**. Jobs não consumidos dentro desse prazo são descartados.

---

## Mensagem: Job (API Core → AI Service)

| Campo | Tipo | Notas |
|-------|------|-------|
| `job_id` | `string` (UUID) | Identificador único do job |
| `organization_id` | `string` | Isolamento de tenant — obrigatório |
| `frame_base64` | `string` | Frame JPEG em base64 — **destruído após processamento** |
| `model_name` | `string` | Default: `'ArcFace'` |
| `detector_backend` | `string` | Default: `'retinaface'` |
| `analyze_sentiment` | `boolean` | Se `true`, executa análise de expressão facial |

---

## Mensagem: Resultado (AI Service → API Core)

| Campo | Tipo | Notas |
|-------|------|-------|
| `job_id` | `string` | Referência ao job original |
| `success` | `boolean` | `false` se nenhuma face detectada ou erro |
| `vector` | `number[]` (512 elementos) | Embedding — `null` se `success=false` |
| `sentiment` | `object \| null` | `{ label, score, all_scores }` |
| `processing_ms` | `number` | Tempo total de processamento em ms |
| `error` | `string \| null` | Código de erro se `success=false` (ex: `'NO_FACE_DETECTED'`) |

---

## Diagrama de Sequência

```
API Core (Bun)                Redis                 AI Service (Python)
     │                          │                          │
     │── LPUSH queue:embedding ──▶│                          │
     │                          │◀── BLPOP (aguarda) ───────│
     │                          │───── job payload ─────────▶│
     │                          │              processa frame │
     │                          │              (RAM-only)     │
     │                          │◀── SETEX result:{jobId} ───│
     │◀── GET result:{jobId} ───│                          │
     │   (poll ou await TTL)    │                          │
     │                          │                          │
```

---

## Timeout e Resiliência

O tempo de espera da API Core pelo resultado é de **3000ms** (configurável). Se o resultado não chegar dentro do prazo, o job é considerado falho. Para comportamento de degradação quando o AI Service está indisponível, ver [circuit-breaker.md](./circuit-breaker.md).
