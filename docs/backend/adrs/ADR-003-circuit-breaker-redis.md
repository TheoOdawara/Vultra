# ADR-003 — Circuit Breaker para Comunicação com o AI Service

> **Status:** Aceito  
> **Data:** Fevereiro 2026  
> **Contexto:** API Core (Bun) ↔ AI Service (Python) via Redis

---

## Contexto

A API Core publica jobs numa fila Redis e aguarda o resultado do AI Service. Se o AI Service ficar lento ou indisponível, os requests da API ficam bloqueados aguardando o timeout do result key. Em cenário de múltiplos usuários simultâneos, isso pode esgotar o pool de conexões e derrubar a API inteira.

---

## Decisão

Implementar o padrão **Circuit Breaker** no adapter `AIJobQueue`, encapsulando a lógica de falha antes de publicar no Redis.

---

## Justificativa

Alternativas consideradas:

| Abordagem | Avaliação |
|-----------|-----------|
| Timeout simples no `await` | ✅ Simples, mas não evita tentativas repetidas quando o serviço está claramente fora |
| Retry com backoff exponencial | ⚠️ Piora o problema — aumenta a fila quando o AI Service já está sem capacidade |
| Circuit Breaker | ✅ Isola a falha, falha rápido, permite recuperação gradual (HALF-OPEN) |
| Desabilitar feature quando AI indisponível | ⚠️ Possível, mas requer lógica manual duplicada em cada handler |

O Circuit Breaker é o único padrão que combina: **falha rápida** (evita bloqueio), **recuperação automática** (HALF-OPEN) e **transparência para o domínio** (a interface `IAIQueueAdapter` não muda).

---

## Consequências

- **Positivas:** A API nunca fica bloqueada por falha do AI Service. O cliente recebe `503` imediatamente com `retryAfter`. O Portal Admin pode exibir o estado via `GET /v1/health/ai-service`.
- **Negativas:** Pequena complexidade adicional no adapter. Requer Redis para armazenar o estado do circuito (garante consistência entre múltiplas instâncias da API).
- **Restrição:** O fallback silencioso (registrar presença sem reconhecimento facial quando o circuito está aberto) é **explicitamente proibido** — viola a rastreabilidade do sistema.

---

## Parâmetros Definidos

| Parâmetro | Valor |
|-----------|-------|
| `failureThreshold` | `5` falhas consecutivas |
| `jobTimeout` | `3000ms` |
| `cooldownPeriod` | `30s` |
| `successThreshold` | `2` sucessos consecutivos |
