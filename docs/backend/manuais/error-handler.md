# 🚨 Error Handler Global

> **← [Voltar ao Backend](../README.md)**

---

## Arquitetura do Handler

Todos os erros são capturados pelo plugin `globalErrorHandler` via hook `.onError()` do ElysiaJS, montado como o **primeiro plugin** no bootstrap da aplicação.

### Ordem de prioridade no mapeamento

```
1. Erros de domínio conhecidos (DomainError e subclasses)
2. Erros de validação TypeBox (400)
3. Erros de autenticação/autorização do Better Auth (401/403)
4. Fallback genérico → 500 (sem expor stack trace em produção)
```

> **Regra:** Stack traces **nunca** são expostos em produção. O body da resposta de erro contém apenas `{ error: string, message?: string }`.

---

## Mapa de Códigos HTTP Semânticos

| Situação | HTTP Status | Código de Erro |
|----------|-------------|----------------|
| Presença já registrada na sessão | `409 Conflict` | `ATTENDANCE_CONFLICT` |
| Face não reconhecida acima do threshold | `404 Not Found` | `FACE_NOT_RECOGNIZED` |
| Token inválido (ESP32) | `401 Unauthorized` | `INVALID_DEVICE_TOKEN` |
| Score de confiança abaixo do threshold | `422 Unprocessable` | `LOW_CONFIDENCE_MATCH` |
| Validação TypeBox falhou | `400 Bad Request` | `VALIDATION_ERROR` |
| Tenant/organização não encontrado | `404 Not Found` | `ORGANIZATION_NOT_FOUND` |
| AI Service indisponível (Circuit Breaker aberto) | `503 Service Unavailable` | `AI_SERVICE_UNAVAILABLE` |
| Sessão de chamada encerrada | `409 Conflict` | `SESSION_ALREADY_CLOSED` |
| Permissão insuficiente | `403 Forbidden` | `INSUFFICIENT_PERMISSIONS` |

---

## Estrutura de Erro de Domínio

Todos os erros de domínio herdam de `DomainError` (`core/domain/errors/DomainError.ts`). A classe base define o `errorCode` (string) e o `httpStatus` (number). O handler global lê essas propriedades para construir a resposta.

---

## Resposta Padrão de Erro

```json
{
  "error": "ATTENDANCE_CONFLICT",
  "message": "Presença já registrada para este membro nesta sessão."
}
```

O campo `message` é opcional e deve ser omitido em erros que não devem revelar detalhes ao cliente (ex: erros internos).
