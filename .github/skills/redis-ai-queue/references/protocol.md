# Redis AI Queue — Protocolo de Canais e Schemas

## Canais Redis

| Canal | Direção | Descrição |
|-------|---------|-----------|
| `vultra:queue:embedding` | API Core → AI Service | Jobs de reconhecimento facial (LPUSH) |
| `vultra:result:{job_id}` | AI Service → API Core | Resultado do job (LPUSH + SETEX 60s) |
| `vultra:queue:sentiment` | API Core → AI Service | Jobs de análise de sentimento (futuro) |

---

## Schema de Job (API Core → AI Service)

```typescript
interface AIJob {
  job_id:          string;  // UUID v4
  organization_id: string;  // UUID — isolamento multitenant
  frame_base64:    string;  // Imagem JPEG em base64 — NUNCA logar ou persistir
  model_name:      'ArcFace';
  timestamp:       number;  // Date.now() — para métricas de latência
}
```

---

## Schema de Resultado (AI Service → API Core)

```typescript
interface AIResult {
  job_id:    string;
  success:   boolean;
  vector?:   number[];     // 512 floats (ArcFace) — apenas se success = true
  sentiment?: {
    label: 'positive' | 'neutral' | 'negative';
    score: number;         // 0.0 – 1.0
  };
  error?:    string;       // Código de erro interno do AI Service
  latency_ms: number;      // Tempo de inferência no Python
}
```

---

## Ciclo de Vida de um Job

```
API Core                          Redis                AI Service (Python)
   │                                │                        │
   ├─ LPUSH vultra:queue:embedding ──►                        │
   │                                ├── BRPOP (blocking) ─────►
   │                                │                        ├─ DeepFace.represent()
   │                                │                        ├─ Gerar embedding 512d
   │                                ◄── LPUSH vultra:result:{id} ─┤
   │                                ├── SETEX TTL 60s        │
   ◄─ BRPOP vultra:result:{id} ─────┤                        │
   │   (timeout 3s)                 │
```

---

## Implementação do Adapter (API Core)

```typescript
// adapters/queue/AIQueueAdapter.ts
import { Redis }                  from 'ioredis';
import { AIServiceUnavailableError, FaceNotRecognizedError } from '../../core/errors';

export class RedisAIQueueAdapter implements IAIQueueAdapter {
  constructor(private readonly redis: Redis) {}

  async processFrame(dto: AIFrameDTO): Promise<AIResult> {
    const jobId = crypto.randomUUID();
    const job: AIJob = {
      job_id:          jobId,
      organization_id: dto.organizationId,
      frame_base64:    dto.frameBase64,  // descartado após serialize
      model_name:      'ArcFace',
      timestamp:       Date.now(),
    };

    await this.redis.lpush('vultra:queue:embedding', JSON.stringify(job));

    // BRPOP bloqueia até 3s aguardando resultado
    const raw = await this.redis.brpop(`vultra:result:${jobId}`, 3);

    if (!raw) throw new AIServiceUnavailableError();

    const result: AIResult = JSON.parse(raw[1]);
    if (!result.success) throw new FaceNotRecognizedError();

    return result;
  }
}
```

---

## Configuração do AI Service (Python)

```python
# worker.py — consumidor da fila
import redis, json, asyncio

r = redis.Redis(host='redis', port=6379)

while True:
    _, raw = r.brpop('vultra:queue:embedding')  # blocking
    job     = json.loads(raw)
    
    # processar em RAM — nunca write em disco
    vector  = process_frame(job['frame_base64'], job['model_name'])
    
    result = {
        'job_id':    job['job_id'],
        'success':   True,
        'vector':    vector.tolist(),
        'latency_ms': ...,
    }
    
    result_key = f"vultra:result:{job['job_id']}"
    r.lpush(result_key, json.dumps(result))
    r.expire(result_key, 60)  # TTL 60s
```
