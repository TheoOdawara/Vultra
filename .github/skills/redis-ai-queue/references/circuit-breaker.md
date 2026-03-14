# Redis AI Queue — Circuit Breaker

## Estados e Transições

```
CLOSED ──(5 falhas consecutivas)──► OPEN ──(30s cooldown)──► HALF-OPEN
  ▲                                                              │
  └──────────────(2 sucessos consecutivos)──────────────────────┘
```

| Estado | Comportamento | Transição |
|--------|--------------|-----------|
| `CLOSED` | Passa todos os requests normalmente | → `OPEN` após `failureThreshold` falhas consecutivas |
| `OPEN` | Rejeita imediatamente com 503 | → `HALF-OPEN` após `cooldownPeriod` ms |
| `HALF-OPEN` | Passa um request de teste | → `CLOSED` após `successThreshold` sucessos · → `OPEN` se falhar |

---

## Parâmetros

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `failureThreshold` | `5` | Falhas consecutivas para abrir o circuito |
| `jobTimeout` | `3000ms` | Timeout do BRPOP (SLA de reconhecimento) |
| `cooldownPeriod` | `30s` | Tempo em OPEN antes de testar novamente |
| `successThreshold` | `2` | Sucessos necessários em HALF-OPEN para fechar |

> **Nota:** Estado do Circuit Breaker persiste no Redis (não em memória), garantindo consistência em múltiplas instâncias da API.

---

## Implementação do Adapter com Circuit Breaker

```typescript
// adapters/queue/AIQueueAdapter.ts
import { Redis }                  from 'ioredis';
import { AIServiceUnavailableError } from '../../core/errors';

type CBState = 'CLOSED' | 'OPEN' | 'HALF-OPEN';

const CB_STATE_KEY    = 'vultra:circuit_breaker:ai_service:state';
const CB_FAILURES_KEY = 'vultra:circuit_breaker:ai_service:failures';
const CB_LAST_OPEN    = 'vultra:circuit_breaker:ai_service:opened_at';

const FAILURE_THRESHOLD  = 5;
const COOLDOWN_MS        = 30_000;
const SUCCESS_THRESHOLD  = 2;

export class AIQueueAdapter implements IAIQueueAdapter {
  constructor(private readonly redis: Redis) {}

  async processFrame(dto: AIFrameDTO): Promise<AIResult> {
    const state = await this.getCircuitState();

    if (state === 'OPEN') throw new AIServiceUnavailableError();

    try {
      const result = await this.dispatchJob(dto);
      await this.onSuccess(state);
      return result;
    } catch (err) {
      await this.onFailure(state);
      throw err;
    }
  }

  private async getCircuitState(): Promise<CBState> {
    const raw = await this.redis.get(CB_STATE_KEY);
    const state = (raw ?? 'CLOSED') as CBState;

    if (state === 'OPEN') {
      const openedAt = Number(await this.redis.get(CB_LAST_OPEN) ?? '0');
      if (Date.now() - openedAt >= COOLDOWN_MS) {
        await this.redis.set(CB_STATE_KEY, 'HALF-OPEN');
        return 'HALF-OPEN';
      }
    }
    return state;
  }

  private async onSuccess(prevState: CBState) {
    if (prevState === 'HALF-OPEN') {
      const successes = await this.redis.incr('vultra:circuit_breaker:ai_service:successes');
      if (successes >= SUCCESS_THRESHOLD) {
        await this.redis.mset({
          [CB_STATE_KEY]:    'CLOSED',
          [CB_FAILURES_KEY]: '0',
          'vultra:circuit_breaker:ai_service:successes': '0',
        });
      }
    } else {
      await this.redis.set(CB_FAILURES_KEY, '0');
    }
  }

  private async onFailure(prevState: CBState) {
    const failures = await this.redis.incr(CB_FAILURES_KEY);
    if (failures >= FAILURE_THRESHOLD || prevState === 'HALF-OPEN') {
      await this.redis.mset({
        [CB_STATE_KEY]: 'OPEN',
        [CB_LAST_OPEN]: String(Date.now()),
      });
    }
  }

  private async dispatchJob(dto: AIFrameDTO): Promise<AIResult> {
    const jobId = crypto.randomUUID();
    await this.redis.lpush('vultra:queue:embedding', JSON.stringify({
      job_id:          jobId,
      organization_id: dto.organizationId,
      frame_base64:    dto.frameBase64,
      model_name:      'ArcFace',
      timestamp:       Date.now(),
    }));

    const raw = await this.redis.brpop(`vultra:result:${jobId}`, 3);
    if (!raw) throw new AIServiceUnavailableError();

    return JSON.parse(raw[1]) as AIResult;
  }
}
```

---

## Endpoint de Saúde

```typescript
// routes/health.ts
app.get('/v1/health/ai-service', async () => {
  const state    = await redis.get('vultra:circuit_breaker:ai_service:state') ?? 'CLOSED';
  const failures = Number(await redis.get('vultra:circuit_breaker:ai_service:failures') ?? 0);

  return {
    status:           state === 'CLOSED' ? 'healthy' : state === 'OPEN' ? 'unavailable' : 'degraded',
    circuit_state:    state,
    failure_count:    failures,
    failure_threshold: FAILURE_THRESHOLD,
  };
});
```
