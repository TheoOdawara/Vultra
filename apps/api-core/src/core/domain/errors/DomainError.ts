/**
 * VULTRA — Domain Errors
 *
 * All domain errors extend DomainError with an errorCode (string) and
 * httpStatus (number). The global error handler reads these properties
 * to build the HTTP response — handlers never construct error responses manually.
 *
 * Conventions:
 *   errorCode  → SCREAMING_SNAKE_CASE, matches the error map in shared/infra/http/error-response.ts
 *   httpStatus → standard HTTP semantics
 */

export class DomainError extends Error {
  constructor(
    public readonly errorCode: string,
    public readonly httpStatus: number,
    message?: string
  ) {
    super(message ?? errorCode);
    this.name = this.constructor.name;
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export class UnauthorizedError extends DomainError {
  constructor() {
    super("UNAUTHORIZED", 401, "Authentication required");
  }
}

export class ForbiddenError extends DomainError {
  constructor() {
    super("INSUFFICIENT_PERMISSIONS", 403, "Insufficient permissions");
  }
}

export class InvalidDeviceTokenError extends DomainError {
  constructor() {
    super("INVALID_DEVICE_TOKEN", 401, "Invalid or missing device token");
  }
}

// ── Organization ──────────────────────────────────────────────────────────────

export class OrganizationNotFoundError extends DomainError {
  constructor() {
    super("ORGANIZATION_NOT_FOUND", 404, "Organization not found");
  }
}

// ── Attendance ────────────────────────────────────────────────────────────────

export class AttendanceConflictError extends DomainError {
  constructor() {
    super("ATTENDANCE_CONFLICT", 409, "Presence already recorded for this member in this session");
  }
}

export class SessionAlreadyClosedError extends DomainError {
  constructor() {
    super("SESSION_ALREADY_CLOSED", 409, "Attendance session is already closed");
  }
}

export class SessionNotFoundError extends DomainError {
  constructor() {
    super("SESSION_NOT_FOUND", 404, "Attendance session not found");
  }
}

// ── Face recognition ──────────────────────────────────────────────────────────

export class FaceNotRecognizedError extends DomainError {
  constructor() {
    super("FACE_NOT_RECOGNIZED", 404, "No member matched above the confidence threshold");
  }
}

export class LowConfidenceMatchError extends DomainError {
  constructor(public readonly confidence: number) {
    super(
      "LOW_CONFIDENCE_MATCH",
      422,
      `Match confidence ${confidence.toFixed(3)} is below the threshold — manual review required`
    );
  }
}

// ── Biometrics ────────────────────────────────────────────────────────────────

export class BiometricProfileNotFoundError extends DomainError {
  constructor() {
    super("BIOMETRIC_PROFILE_NOT_FOUND", 404, "No active biometric profile found for member");
  }
}

export class BiometricEnrollConflictError extends DomainError {
  constructor() {
    super(
      "BIOMETRIC_ENROLL_CONFLICT",
      409,
      "An active biometric profile already exists for this member and model version"
    );
  }
}

export class PayloadTooLargeError extends DomainError {
  constructor() {
    super("PAYLOAD_TOO_LARGE", 413, "Payload exceeds the maximum allowed size");
  }
}

export class RateLimitExceededError extends DomainError {
  constructor(public readonly retryAfter: number) {
    super("RATE_LIMIT_EXCEEDED", 429, "Too many requests");
  }
}

// ── AI Service ────────────────────────────────────────────────────────────────

export class AIServiceUnavailableError extends DomainError {
  constructor(public readonly retryAfter: number = 30) {
    super("AI_SERVICE_UNAVAILABLE", 503, "AI service is currently unavailable");
  }
}

export class AIJobTimeoutError extends DomainError {
  constructor() {
    super("AI_SERVICE_UNAVAILABLE", 503, "AI job timed out — service may be degraded");
  }
}

// ── Reports ───────────────────────────────────────────────────────────────────

export class InvalidReportRangeError extends DomainError {
  constructor() {
    super("INVALID_REPORT_RANGE", 400, "Report 'from' must be earlier than 'to'");
  }
}

// ── Frame quality ─────────────────────────────────────────────────────────────

export class LowQualityFrameError extends DomainError {
  constructor(public readonly qualityScore: number) {
    super(
      "LOW_QUALITY",
      422,
      `Frame quality score ${qualityScore.toFixed(3)} is below the minimum enroll threshold`
    );
  }
}
