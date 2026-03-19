# Erros de Domínio — `DomainError` e Subclasses

## Classe Base

```typescript
// core/domain/errors/DomainError.ts
export abstract class DomainError extends Error {
  abstract readonly code:       string;
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
```

---

## Erros do Vultra

```typescript
// core/domain/errors/AttendanceConflictError.ts
export class AttendanceConflictError extends DomainError {
  readonly code       = 'ATTENDANCE_CONFLICT';
  readonly httpStatus = 409;
  constructor(memberId: string, sessionId: string) {
    super(`Membro ${memberId} já registrou presença na sessão ${sessionId}.`);
  }
}

// core/domain/errors/FaceNotRecognizedError.ts
export class FaceNotRecognizedError extends DomainError {
  readonly code       = 'FACE_NOT_RECOGNIZED';
  readonly httpStatus = 404;
  constructor() { super('Nenhum membro corresponde ao embedding gerado.'); }
}

// core/domain/errors/LowConfidenceMatchError.ts
export class LowConfidenceMatchError extends DomainError {
  readonly code       = 'LOW_CONFIDENCE_MATCH';
  readonly httpStatus = 422;
  constructor(similarity: number) {
    super(`Similaridade ${similarity.toFixed(3)} abaixo do threshold mínimo.`);
  }
}

// core/domain/errors/UnauthorizedError.ts
export class UnauthorizedError extends DomainError {
  readonly code       = 'UNAUTHORIZED';
  readonly httpStatus = 401;
  constructor() { super('Autenticação necessária.'); }
}

// core/domain/errors/InvalidDeviceTokenError.ts
export class InvalidDeviceTokenError extends DomainError {
  readonly code       = 'INVALID_DEVICE_TOKEN';
  readonly httpStatus = 401;
  constructor() { super('Token de dispositivo inválido ou expirado.'); }
}

// core/domain/errors/AIServiceUnavailableError.ts
export class AIServiceUnavailableError extends DomainError {
  readonly code       = 'AI_SERVICE_UNAVAILABLE';
  readonly httpStatus = 503;
  constructor() { super('AI Service indisponível. Tente novamente em 30 segundos.'); }
}

// core/domain/errors/SessionAlreadyClosedError.ts
export class SessionAlreadyClosedError extends DomainError {
  readonly code       = 'SESSION_ALREADY_CLOSED';
  readonly httpStatus = 409;
  constructor(sessionId: string) { super(`Sessão ${sessionId} já está encerrada.`); }
}

// core/domain/errors/InsufficientPermissionsError.ts
export class InsufficientPermissionsError extends DomainError {
  readonly code       = 'INSUFFICIENT_PERMISSIONS';
  readonly httpStatus = 403;
  constructor() { super('Permissão insuficiente para esta operação.'); }
}
```

---

## Mapa Completo — Código → HTTP

| `code` | `httpStatus` | Situação |
|--------|-------------|----------|
| `ATTENDANCE_CONFLICT` | 409 | Presença já registrada na sessão |
| `SESSION_ALREADY_CLOSED` | 409 | Tentativa de operar em sessão encerrada |
| `FACE_NOT_RECOGNIZED` | 404 | Embedding sem match acima do threshold |
| `ORGANIZATION_NOT_FOUND` | 404 | Tenant não encontrado |
| `LOW_CONFIDENCE_MATCH` | 422 | Similaridade entre 0.75 e 0.84 |
| `UNAUTHORIZED` | 401 | Sessão ausente ou expirada |
| `INVALID_DEVICE_TOKEN` | 401 | `X-Device-Token` inválido |
| `INSUFFICIENT_PERMISSIONS` | 403 | Role sem permissão para a ação |
| `AI_SERVICE_UNAVAILABLE` | 503 | Circuit Breaker aberto |
| `VALIDATION_ERROR` | 400 | TypeBox rejeitou body/query/params |
