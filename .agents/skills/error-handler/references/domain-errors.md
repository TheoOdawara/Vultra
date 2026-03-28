# Error Handler — Classes de DomainError

## Classe Base

```typescript
// core/errors/DomainError.ts
export abstract class DomainError extends Error {
  abstract readonly code:       string;
  abstract readonly httpStatus: number;

  constructor(message?: string) {
    super(message ?? 'Domain error');
    this.name = this.constructor.name;
  }
}
```

---

## Hierarquia Completa de Erros

```typescript
// core/errors/index.ts

// --- 4xx Client Errors ---

export class AttendanceConflictError extends DomainError {
  readonly code       = 'ATTENDANCE_CONFLICT';
  readonly httpStatus = 409;
  constructor() { super('Presença já registrada para este membro nesta sessão'); }
}

export class SessionAlreadyClosedError extends DomainError {
  readonly code       = 'SESSION_ALREADY_CLOSED';
  readonly httpStatus = 409;
  constructor() { super('Sessão de presença já foi encerrada'); }
}

export class FaceNotRecognizedError extends DomainError {
  readonly code       = 'FACE_NOT_RECOGNIZED';
  readonly httpStatus = 404;
  constructor() { super('Nenhum perfil biométrico correspondente encontrado'); }
}

export class OrganizationNotFoundError extends DomainError {
  readonly code       = 'ORGANIZATION_NOT_FOUND';
  readonly httpStatus = 404;
  constructor() { super('Organização não encontrada'); }
}

export class MemberNotFoundError extends DomainError {
  readonly code       = 'MEMBER_NOT_FOUND';
  readonly httpStatus = 404;
  constructor() { super('Membro não encontrado'); }
}

export class LowConfidenceMatchError extends DomainError {
  readonly code       = 'LOW_CONFIDENCE_MATCH';
  readonly httpStatus = 422;
  constructor(public readonly score: number) {
    super(`Confiança insuficiente: ${(score * 100).toFixed(1)}%`);
  }
}

export class UnauthorizedError extends DomainError {
  readonly code       = 'UNAUTHORIZED';
  readonly httpStatus = 401;
  constructor() { super('Autenticação necessária'); }
}

export class InvalidDeviceTokenError extends DomainError {
  readonly code       = 'INVALID_DEVICE_TOKEN';
  readonly httpStatus = 401;
  constructor() { super('Token de dispositivo inválido'); }
}

export class InsufficientPermissionsError extends DomainError {
  readonly code       = 'INSUFFICIENT_PERMISSIONS';
  readonly httpStatus = 403;
  constructor() { super('Permissões insuficientes para esta operação'); }
}

export class ConsentRequiredError extends DomainError {
  readonly code       = 'CONSENT_REQUIRED';
  readonly httpStatus = 403;
  constructor(message?: string) { super(message ?? 'Consentimento biométrico necessário'); }
}

// --- 5xx Server Errors ---

export class AIServiceUnavailableError extends DomainError {
  readonly code       = 'AI_SERVICE_UNAVAILABLE';
  readonly httpStatus = 503;
  constructor() { super('Serviço de IA indisponível — tente novamente em instantes'); }
}
```

---

## Extensão de Novos Erros

```typescript
// Padrão para criar novos erros:
export class YourNewError extends DomainError {
  readonly code       = 'YOUR_ERROR_CODE';   // SCREAMING_SNAKE_CASE
  readonly httpStatus = 422;                 // semântico (ver tabela em http-codes.md)
  constructor(public readonly context?: string) {
    super(`Descrição clara do erro${context ? `: ${context}` : ''}`);
  }
}
```

> **Regra:** O código (`code`) deve ser único globalmente. Veja [references/http-codes.md](http-codes.md) para a tabela de mapeamentos.
