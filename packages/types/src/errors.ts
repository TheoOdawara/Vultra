export const API_ERROR_CODES = [
  "UNAUTHORIZED",
  "INVALID_DEVICE_TOKEN",
  "INSUFFICIENT_PERMISSIONS",
  "NOT_FOUND",
  "VALIDATION_ERROR",
  "INVALID_CURSOR",
  "INVALID_REPORT_RANGE",
  "ATTENDANCE_CONFLICT",
  "SESSION_ALREADY_CLOSED",
  "CLASS_CODE_TAKEN",
  "PRECONDITION_REQUIRED",
  "PRECONDITION_FAILED",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMIT_EXCEEDED",
  "RATE_LIMITER_UNAVAILABLE",
  "LOW_QUALITY_FRAME",
  "NO_FRONTAL_FACE",
  "LIVENESS_CHECK_FAILED",
  "MULTIPLE_FACES",
  "NO_FACE_DETECTED",
  "MEMBER_NOT_FOUND",
  "BIOMETRIC_PROFILE_NOT_FOUND",
  "MEMBER_NOT_ENROLLED_IN_CLASS",
  "AI_SERVICE_UNAVAILABLE",
  "INTERNAL_SERVER_ERROR",
] as const;

export type KnownApiErrorCode = (typeof API_ERROR_CODES)[number];

export type ApiErrorCode = KnownApiErrorCode | (string & {});

export interface ApiErrorDetail {
  field: string;
  rule: string;
  message: string;
}

export interface ApiErrorPayload {
  code: ApiErrorCode;
  message: string;
  correlationId: string;
  details?: ApiErrorDetail[];
}

export interface ApiErrorBody {
  error: ApiErrorPayload;
}

export function isKnownApiErrorCode(code: string): code is KnownApiErrorCode {
  return (API_ERROR_CODES as readonly string[]).includes(code);
}
