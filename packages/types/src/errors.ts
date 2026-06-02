/**
 * VULTRA — API Error Types
 *
 * All error responses from the API Core follow the shape `{ error: string }`.
 * Known error codes are enumerated here for type-safe error handling in frontends.
 */

/** Standard error response body returned by the API Core. */
export interface ApiError {
  error: string;
}

// ── Known error codes ──────────────────────────────────────────────────────────

/** Error codes returned by auth / session middleware. */
export type AuthErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ORGANIZATION_NOT_FOUND"
  | "SESSION_EXPIRED";

/** Error codes returned by members endpoints. */
export type MemberErrorCode =
  | "MEMBER_NOT_FOUND"
  | "MEMBER_EXTERNAL_CODE_CONFLICT";

/** Error codes returned by devices endpoints. */
export type DeviceErrorCode =
  | "DEVICE_NOT_FOUND"
  | "DEVICE_NOT_ACTIVE";

/** Error codes returned by attendance endpoints. */
export type AttendanceErrorCode =
  | "SESSION_NOT_FOUND"
  | "SESSION_ALREADY_CLOSED"
  | "SESSION_ALREADY_OPEN_FOR_DEVICE"
  | "ATTENDANCE_RECORD_CONFLICT";

/** Error codes returned by biometric/face endpoints. */
export type BiometricErrorCode =
  | "BIOMETRIC_ENROLL_CONFLICT"
  | "BIOMETRIC_PROFILE_NOT_FOUND"
  | "FACE_QUALITY_TOO_LOW"
  | "FACE_NOT_DETECTED";

/** Error codes from report endpoints. */
export type ReportErrorCode =
  | "INVALID_REPORT_RANGE";

/**
 * Error codes from AI Service failures (circuit breaker open).
 * Frontend should surface a graceful degradation message when these appear.
 */
export type AiServiceErrorCode =
  | "AI_SERVICE_UNAVAILABLE"
  | "AI_JOB_TIMEOUT";

/** Union of all known API error codes. */
export type KnownErrorCode =
  | AuthErrorCode
  | MemberErrorCode
  | DeviceErrorCode
  | AttendanceErrorCode
  | BiometricErrorCode
  | ReportErrorCode
  | AiServiceErrorCode;

/**
 * Type guard — narrows an ApiError to a known error code.
 *
 * @example
 * if (isKnownError(err, "AI_SERVICE_UNAVAILABLE")) {
 *   showDegradedBanner(err.retryAfter);
 * }
 */
export function isKnownError(
  err: ApiError,
  code: KnownErrorCode
): boolean {
  return err.error === code;
}

/**
 * Response body for `AI_SERVICE_UNAVAILABLE` (503).
 * The `retryAfter` field is the circuit breaker cooldown in seconds.
 */
export interface AiUnavailableError extends ApiError {
  error: "AI_SERVICE_UNAVAILABLE";
  retryAfter: number;
}
