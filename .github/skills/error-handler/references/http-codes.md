# Error Handler — Códigos HTTP Semânticos

## Mapeamento Completo

| `DomainError.code` | HTTP Status | Significado Semântico | Quando usar |
|---------------------|------------|----------------------|-------------|
| `ATTENDANCE_CONFLICT` | **409 Conflict** | Recurso já existe no estado atual | Presença duplicada na sessão |
| `SESSION_ALREADY_CLOSED` | **409 Conflict** | Recurso já no estado final | Tentativa de registrar em sessão fechada |
| `FACE_NOT_RECOGNIZED` | **404 Not Found** | Recurso não encontrado | Embedding não encontrado na busca pgvector |
| `ORGANIZATION_NOT_FOUND` | **404 Not Found** | Recurso não encontrado | ID de organização inexistente |
| `MEMBER_NOT_FOUND` | **404 Not Found** | Recurso não encontrado | Membro não encontrado na organização |
| `LOW_CONFIDENCE_MATCH` | **422 Unprocessable** | Dado válido, semântica inaceitável | Similaridade coseno < 0.85 (threshold ArcFace) |
| `UNAUTHORIZED` | **401 Unauthorized** | Sem autenticação | Sessão inexistente ou expirada |
| `INVALID_DEVICE_TOKEN` | **401 Unauthorized** | Credencial inválida | Token ESP32 não corresponde ao hash |
| `INSUFFICIENT_PERMISSIONS` | **403 Forbidden** | Autenticado, mas sem permissão | Role insuficiente para o endpoint |
| `CONSENT_REQUIRED` | **403 Forbidden** | Autorização específica necessária | Consentimento biométrico desatualizado |
| `AI_SERVICE_UNAVAILABLE` | **503 Service Unavailable** | Dependência externa indisponível | Circuit Breaker OPEN ou timeout BRPOP |
| `VALIDATION_ERROR` | **400 Bad Request** | Payload inválido | TypeBox parse error (ElysiaJS nativo) |

---

## `globalErrorHandler` — Implementação Final

```typescript
// adapters/http/middleware/globalErrorHandler.ts
import Elysia              from 'elysia';
import { DomainError }     from '../../../core/errors';

export const globalErrorHandler = new Elysia({ name: 'globalErrorHandler' })
  .onError(({ error, set, request }) => {
    // Erros de domínio mapeados semanticamente
    if (error instanceof DomainError) {
      set.status = error.httpStatus;
      return {
        error:   error.code,
        message: error.message,
      };
    }

    // Erros de validação TypeBox (ElysiaJS emite como ValidationError)
    if (error.message === 'Validation Error') {
      set.status = 400;
      return {
        error:   'VALIDATION_ERROR',
        message: 'Payload inválido — verifique os campos obrigatórios',
      };
    }

    // Erros inesperados — nunca vazar detalhes
    console.error('[UNHANDLED]', {
      path:    new URL(request.url).pathname,
      message: error instanceof Error ? error.message : String(error),
      // NÃO logar error.stack em produção
    });

    set.status = 500;
    return {
      error:   'INTERNAL_ERROR',
      message: 'Erro interno do servidor',
    };
  });
```

---

## Registro Obrigatório em `server.ts`

```typescript
// O globalErrorHandler DEVE ser o PRIMEIRO plugin registrado
const app = new Elysia()
  .use(globalErrorHandler)   // ← PRIMEIRO — captura erros de todos os outros
  .use(cors())
  .use(authRoutes)
  .use(iotRoutes)
  // ...demais plugins
```

> **Por que primeiro?** No ElysiaJS, plugins registrados antes capturam erros dos plugins registrados depois. Se o `globalErrorHandler` vier depois, erros em plugins anteriores não serão capturados.

---

## Formato de Resposta de Erro

Todas as respostas de erro seguem este contrato:

```json
{
  "error":   "ATTENDANCE_CONFLICT",
  "message": "Presença já registrada para este membro nesta sessão"
}
```

- `error` — código máquina em `SCREAMING_SNAKE_CASE` para branch no cliente
- `message` — mensagem legível em português para exibição (pode mudar entre versões)
