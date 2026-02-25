# 📊 KPIs e Métricas do Dashboard

> **← [Voltar ao Admin](../README.md)**

---

## Métricas Exibidas

| Métrica | Fonte (Endpoint) | Atualização | Observação |
|---------|-----------------|-------------|------------|
| Total de membros ativos | `GET /v1/members?active=true` | Cache 5min | Filtrado por `organizationId` |
| Dispositivos online | `GET /v1/devices` (`last_seen_at`) | Real-time WebSocket | Threshold: `last_seen_at` < 60s atrás = online |
| Taxa de presença hoje | `GET /v1/reports/attendance?period=today` | Cache 1min | Percentual sobre sessões abertas no dia |
| Falhas de reconhecimento (24h) | `GET /v1/reports/face-failures` | Cache 5min | `FACE_NOT_RECOGNIZED` + `LOW_CONFIDENCE_MATCH` |
| Jobs na fila de IA | `GET /v1/health/ai-service` | Real-time WebSocket | Inclui `circuitState` |
| Latência média de reconhecimento | `GET /v1/health/ai-service` | Cache 1min | `processing_ms` médio dos últimos 100 jobs |

---

## Comportamento em Degradação

Quando o Circuit Breaker do AI Service está `OPEN`, o `SystemHealthCard` exibe:

- Badge vermelho "IA Indisponível"  
- `circuitState: OPEN`  
- `failureCount` e `lastFailureAt`  
- Botão "Ver detalhes" abrindo modal com histórico de falhas

O dashboard **não deve** esconder este indicador ou minimizá-lo — é informação crítica para o admin.
