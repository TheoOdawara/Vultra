/**
 * VULTRA — Classe base para todos os erros de domínio.
 *
 * Subclasses devem definir `errorCode` e `httpStatus` como readonly
 * e passá-los ao construtor via `super()`.
 *
 * Referência: docs/backend/manuais/error-handler.md
 */
export abstract class DomainError extends Error {
  abstract readonly errorCode: string;
  abstract readonly httpStatus: number;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Mantém stack trace correto em ambientes V8/Bun
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ─── Erros de Presença ────────────────────────────────────────────────────────

export class AttendanceConflictError extends DomainError {
  readonly errorCode = 'ATTENDANCE_CONFLICT' as const;
  readonly httpStatus = 409;
  constructor(message = 'Presença já registrada para este membro nesta sessão.') {
    super(message);
  }
}

export class SessionAlreadyClosedError extends DomainError {
  readonly errorCode = 'SESSION_ALREADY_CLOSED' as const;
  readonly httpStatus = 409;
  constructor(message = 'Sessão de chamada já encerrada.') {
    super(message);
  }
}

export class FaceNotRecognizedError extends DomainError {
  readonly errorCode = 'FACE_NOT_RECOGNIZED' as const;
  readonly httpStatus = 404;
  constructor(message = 'Face não reconhecida acima do threshold de confiança.') {
    super(message);
  }
}

export class LowConfidenceMatchError extends DomainError {
  readonly errorCode = 'LOW_CONFIDENCE_MATCH' as const;
  readonly httpStatus = 422;
  constructor(message = 'Score de confiança abaixo do threshold mínimo.') {
    super(message);
  }
}

// ─── Erros de Autenticação / Autorização ─────────────────────────────────────

export class UnauthorizedError extends DomainError {
  readonly errorCode = 'UNAUTHORIZED' as const;
  readonly httpStatus = 401;
  constructor(message = 'Autenticação necessária.') {
    super(message);
  }
}

export class InvalidDeviceTokenError extends DomainError {
  readonly errorCode = 'INVALID_DEVICE_TOKEN' as const;
  readonly httpStatus = 401;
  constructor(message = 'Token de dispositivo inválido ou expirado.') {
    super(message);
  }
}

export class InsufficientPermissionsError extends DomainError {
  readonly errorCode = 'INSUFFICIENT_PERMISSIONS' as const;
  readonly httpStatus = 403;
  constructor(message = 'Permissão insuficiente para esta operação.') {
    super(message);
  }
}

// ─── Erros de Recurso ─────────────────────────────────────────────────────────

export class OrganizationNotFoundError extends DomainError {
  readonly errorCode = 'ORGANIZATION_NOT_FOUND' as const;
  readonly httpStatus = 404;
  constructor(message = 'Organização não encontrada.') {
    super(message);
  }
}

// ─── Erros de Infraestrutura ──────────────────────────────────────────────────

export class AIServiceUnavailableError extends DomainError {
  readonly errorCode = 'AI_SERVICE_UNAVAILABLE' as const;
  readonly httpStatus = 503;
  constructor(message = 'AI Service indisponível. Tente novamente em instantes.') {
    super(message);
  }
}
