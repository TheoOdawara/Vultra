# ⚡ Circuit Breaker — Resiliência com o AI Service

> **← [Voltar ao Backend](../README.md)**
> Veja o protocolo de fila: [fila-redis.md](./fila-redis.md)

Se o AI Service ficar lento ou indisponível, jobs se acumularão na fila Redis e o `await` do resultado pode **travar a API Core**, degradando toda a experiência. O padrão **Circuit Breaker** isola essa falha e garante resposta imediata ao cliente.

---

## Estados do Circuito

```
CLOSED ──(5 falhas)──→ OPEN ──(30s cooldown)──→ HALF-OPEN ──(2 sucessos)──→ CLOSED
   ↑                                                  │ (falha)
   └──────────────────────────────────────────────────┘
```

| Estado | Comportamento da API |
|--------|---------------------|
| `CLOSED` | Normal. Jobs publicados no Redis, await do resultado. |
| `OPEN` | Requests rejeitados imediatamente com `503 AI_SERVICE_UNAVAILABLE`. Sem publicar no Redis. |
| `HALF-OPEN` | Após cooldown, 1 request de teste passa. Sucesso → `CLOSED`. Falha → `OPEN`. |

---

## Parâmetros

| Parâmetro | Valor | Descrição |
|-----------|-------|-----------|
| `failureThreshold` | `5` | Falhas consecutivas (timeout ou erro) para abrir o circuito |
| `jobTimeout` | `3000ms` | Espera máxima pelo resultado do job de IA via Redis |
| `cooldownPeriod` | `30s` | Tempo em `OPEN` antes de tentar `HALF-OPEN` |
| `successThreshold` | `2` | Sucessos consecutivos em `HALF-OPEN` para fechar o circuito |

---

## Onde Implementar

O Circuit Breaker encapsula o adapter `AIJobQueue` na camada `infrastructure/`. A interface `IAIQueueAdapter` usada pelos Use Cases **não muda** — o padrão é transparente para o domínio.

```
Use Case → IAIQueueAdapter (port — sem mudanças)
                ↓
         AIJobQueue (adapter)
                ↓
      CircuitBreakerWrapper   ← estado e lógica aqui
                ↓
          Redis LPUSH / await result
```

> **Importante:** O estado do circuito (`OPEN` / `CLOSED` / `HALF-OPEN`) deve ser armazenado **no Redis**, não em memória local. Com múltiplas instâncias da API, estado em memória geraria comportamento inconsistente.

---

## Resposta em Degradação

Quando o circuito está `OPEN`, o endpoint retorna imediatamente:

```
HTTP 503 Service Unavailable
{ "error": "AI_SERVICE_UNAVAILABLE", "retryAfter": 30 }
```

O frontend do professor deve exibir mensagem clara: *"Reconhecimento facial temporariamente indisponível. Tente em 30s ou use registro manual."*

> **Proibido:** registrar presença sem reconhecimento facial quando o circuito está aberto (violação de rastreabilidade).

---

## Monitoramento — `GET /v1/health/ai-service`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `status` | `'ok'` \| `'degraded'` \| `'unavailable'` | Estado legível |
| `circuitState` | `'CLOSED'` \| `'OPEN'` \| `'HALF_OPEN'` | Estado técnico (underscore, não hyphen) |
| `failureCount` | `number` | Falhas acumuladas desde o último reset |
| `lastFailureAt` | ISO timestamp \| `null` | Timestamp da última falha |

Consumido pelo Portal Admin para exibir alertas de degradação em tempo real.
