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
| Autenticação ausente ou inválida | `401 Unauthorized` | `UNAUTHORIZED` |
| Permissão insuficiente | `403 Forbidden` | `INSUFFICIENT_PERMISSIONS` |
| Token inválido (ESP32) | `401 Unauthorized` | `INVALID_DEVICE_TOKEN` |
| Validação TypeBox falhou | `422 Unprocessable` | `VALIDATION_ERROR` |
| Tenant/organização não encontrado | `404 Not Found` | `ORGANIZATION_NOT_FOUND` |
| Sessão de chamada não encontrada | `404 Not Found` | `SESSION_NOT_FOUND` |
| Sessão de chamada encerrada | `409 Conflict` | `SESSION_ALREADY_CLOSED` |
| Presença já registrada na sessão | `409 Conflict` | `ATTENDANCE_CONFLICT` |
| Face não reconhecida acima do threshold | `404 Not Found` | `FACE_NOT_RECOGNIZED` |
| Score de confiança abaixo do threshold | `422 Unprocessable` | `LOW_CONFIDENCE_MATCH` |
| Qualidade do frame abaixo do mínimo | `422 Unprocessable` | `LOW_QUALITY` |
| Perfil biométrico não encontrado | `404 Not Found` | `BIOMETRIC_PROFILE_NOT_FOUND` |
| Perfil biométrico já existe para o membro | `409 Conflict` | `BIOMETRIC_ENROLL_CONFLICT` |
| Payload acima do limite permitido | `413 Payload Too Large` | `PAYLOAD_TOO_LARGE` |
| Muitas requisições biométricas | `429 Too Many Requests` | `RATE_LIMIT_EXCEEDED` |
| AI Service indisponível (Circuit Breaker aberto) | `503 Service Unavailable` | `AI_SERVICE_UNAVAILABLE` |
| Membro não encontrado | `404 Not Found` | `MEMBER_NOT_FOUND` |
| Código externo já existe no tenant | `409 Conflict` | `MEMBER_EXTERNAL_CODE_CONFLICT` |
| Dispositivo não encontrado ou inativo | `404 Not Found` | `DEVICE_NOT_FOUND` |
| Intervalo de datas do relatório inválido | `422 Unprocessable` | `INVALID_REPORT_RANGE` |

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
