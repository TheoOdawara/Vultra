---
description: "Redis LPUSH/BLPOP queue protocol entre API Core e AI Service com Circuit Breaker."
---

# Redis AI Queue

Protocolo de filas Redis para comunicação assíncrona entre o **API Core** (ElysiaJS) e o **AI Service** (Python/FastAPI). Garante isolamento de falhas com Circuit Breaker e processamento biométrico sem armazenar imagens brutas.

## When to Use This Skill

- Criar ou modificar `adapters/queue/AIQueueAdapter.ts`
- Implementar ou ajustar o Circuit Breaker do AI Service
- Adicionar novos tipos de jobs para o AI Service (ex: análise de sentimento)
- Debugar timeouts ou falhas de comunicação com o microserviço Python
- Implementar `GET /v1/health/ai-service` ou métricas da fila

## Quick Start

```typescript
// Envio de job (API Core → Redis → AI Service)
const jobId  = crypto.randomUUID();
const job: AIJob = {
  job_id:          jobId,
  organization_id: ctx.organizationId,
  frame_base64:    frameBase64,   // descartado após envio — RAM only
  model_name:      'ArcFace',
};

await redis.lpush('vultra:queue:embedding', JSON.stringify(job));

// Aguardar resultado com timeout de 3s
const raw = await redis.brpop(`vultra:result:${jobId}`, 3);
if (!raw) throw new AIServiceUnavailableError();

const result: AIResult = JSON.parse(raw[1]);
if (!result.success) throw new FaceNotRecognizedError();
```

## Key Rules

| Regra | Motivo |
|-------|--------|
| Nunca logar `frame_base64` | LGPD — dado biométrico bruto |
| Timeout BRPOP = 3000ms | SLA de reconhecimento facial ≤ 3s |
| TTL `SETEX` no resultado = 60s | Evitar vazamento de dados em caso de falha do consumer |
| Circuit Breaker obrigatório | Proteger API de cascade failure quando AI Service cai |
| `organization_id` no job | AI Service deve filtrar embeddings por organização |
| Usar `crypto.randomUUID()` para `job_id` | Evitar colisões em ambientes com múltiplas instâncias |

## Resources

- [Protocolo de canais e schemas de mensagem](references/protocol.md)
- [Circuit Breaker — estados, parâmetros, adapter](references/circuit-breaker.md)
- [Docs arquitetura fila Redis](../../../docs/backend/arquitetura/fila-redis.md)
- [Docs Circuit Breaker](../../../docs/backend/arquitetura/circuit-breaker.md)
- [ADR-003 — Circuit Breaker Redis](../../../docs/backend/adrs/ADR-003-circuit-breaker-redis.md)
