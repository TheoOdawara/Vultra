# 🔄 Fluxo de Chamada em Tempo Real

> **← [Voltar ao Professores](../README.md)**

---

## Fluxo Completo

```
Professor abre sessão (SessionControls)
        │
        ▼
API Core: POST /v1/attendance/sessions → cria attendance_session (status: 'open')
        │
        ▼
ESP32-CAM(s) na sala enviam frames via POST /v1/attendance/record
        │
        ▼
API Core → Redis Queue → AI Service → vector matching → attendance_record
        │
        ▼
WebSocket event publicado: { type: "PRESENCE_RECORDED", ... }
        │
        ▼
LiveAttendancePanel atualiza em tempo real
        │
        ▼
Professor encerra sessão → PATCH .../close → status: 'closed'
```

---

## Eventos WebSocket

| Tipo de Evento | Campos | Descrição |
|----------------|--------|-----------|
| `PRESENCE_RECORDED` | `memberId`, `name`, `confidence`, `sentiment?`, `recordedAt` | Aluno reconhecido com sucesso |
| `SESSION_CLOSED` | `sessionId` | Sessão encerrada (remoto ou timeout) |
| `DEVICE_OFFLINE` | `deviceId`, `label` | ESP32 parou de enviar heartbeat (> 60s) |
| `FACE_NOT_RECOGNIZED` | `deviceId`, `timestamp` | Frame processado sem match acima do threshold |
| `AI_SERVICE_DEGRADED` | `circuitState`, `retryAfter` | Circuit Breaker aberto — reconhecimento indisponível |

---

## Hook `useAttendanceWebSocket`

O hook `useAttendanceWebSocket(sessionId)` em `lib/websocket.ts` gerencia a conexão WebSocket e retorna:

| Propriedade | Tipo | Descrição |
|-------------|------|-----------|
| `events` | `AttendanceEvent[]` | Array acumulado de eventos da sessão |
| `isConnected` | `boolean` | Estado da conexão |
| `deviceStatus` | `Record<deviceId, 'online' \| 'offline'>` | Status dos ESP32 da sala |

Reconexão automática com backoff exponencial em caso de queda da conexão.
