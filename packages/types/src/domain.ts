/**
 * VULTRA — Core Domain Types
 *
 * These are the canonical representations of domain entities as returned by the
 * API Core. All timestamps are ISO 8601 strings (serialized from Date in the API).
 */

// ── Roles ─────────────────────────────────────────────────────────────────────

/** RBAC roles available within a VULTRA tenant. */
export type MemberRole = "admin" | "professor" | "rh" | "student";

// ── Member ────────────────────────────────────────────────────────────────────

/**
 * A member of a VULTRA tenant. Represents a person tracked by the system
 * (student, professor, admin, or HR staff).
 *
 * LGPD: `deletedAt` != null indicates soft-deleted (data retained per policy).
 */
export interface Member {
  id: string;
  organizationId: string;
  /** Auth user ID (Better Auth `auth_users.id`). Null if no account linked yet. */
  userId: string | null;
  fullName: string;
  email: string | null;
  role: MemberRole;
  /** External system identifier (e.g., student enrollment number). */
  externalCode: string | null;
  isActive: boolean;
  /** ISO 8601 — null when not soft-deleted. */
  deletedAt: string | null;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

// ── Device ────────────────────────────────────────────────────────────────────

/**
 * An ESP32-CAM IoT device registered to a tenant.
 * Devices authenticate via `X-Device-Token` header (bcrypt-hashed API key).
 */
export interface Device {
  id: string;
  organizationId: string;
  /** Human-readable label (e.g., "CAM-SALA-101"). */
  label: string;
  location: string | null;
  firmwareVersion: string | null;
  /** ISO 8601 — null if device has never connected. */
  lastSeenAt: string | null;
  isActive: boolean;
  /** ISO 8601 */
  createdAt: string;
  /** ISO 8601 */
  updatedAt: string;
}

// ── Attendance Session ─────────────────────────────────────────────────────────

/** Status of an attendance session. */
export type SessionStatus = "open" | "closed" | "cancelled";

/**
 * An attendance capture session — opened by a device, closed by a professor
 * or automatically after a configured duration.
 */
export interface AttendanceSession {
  id: string;
  organizationId: string;
  /** Null for corporate check-in context; set for educational context. */
  classId: string | null;
  deviceId: string;
  professorId: string | null;
  /** ISO 8601 */
  startedAt: string;
  /** ISO 8601 — null while session is open. */
  endedAt: string | null;
  status: SessionStatus;
}

// ── Attendance Record ─────────────────────────────────────────────────────────

/** How a presence record was created. */
export type RecognitionMethod = "face" | "manual";

/** Sentiment label from AI facial analysis. */
export type SentimentLabel =
  | "happy"
  | "neutral"
  | "sad"
  | "angry"
  | "surprise"
  | "fear"
  | "disgust";

/**
 * A single presence record for a member in a session.
 *
 * LGPD: No frame or embedding is included. Only the derived metadata.
 */
export interface AttendanceRecord {
  id: string;
  organizationId: string;
  sessionId: string;
  memberId: string;
  /** ISO 8601 */
  recordedAt: string;
  /** Cosine similarity score [0, 1]. */
  confidenceScore: number;
  /** Snapshot of the active threshold at record time (default 0.85). */
  matchThreshold: number;
  recognitionMethod: RecognitionMethod;
  sentimentLabel: SentimentLabel | null;
  /** Dominant sentiment confidence [0, 1]. */
  sentimentScore: number | null;
  isManual: boolean;
}

// ── Biometric Profile ──────────────────────────────────────────────────────────

/**
 * Biometric profile of a member — references the stored face embedding.
 *
 * LGPD Art. 11: The embedding itself is NEVER returned in API responses.
 * Only metadata is exposed.
 */
export interface BiometricProfile {
  profileId: string;
  organizationId: string;
  memberId: string;
  /** Model used to generate the embedding (e.g., "ArcFace-v1"). */
  modelVersion: string;
  /** Quality score of the enrolled frame [0, 1]. Enrolls < 0.50 are rejected. */
  qualityScore: number;
  /** False = revoked by LGPD request or pending re-enrollment. */
  isActive: boolean;
  /** UUID of the device that captured the enrollment frame. */
  deviceId: string | null;
  /** UUID of the actor who initiated the enrollment. */
  createdBy: string | null;
  /** ISO 8601 */
  enrolledAt: string;
  /** ISO 8601 — null if never matched after enrollment. */
  lastMatchedAt: string | null;
  /** ISO 8601 — null if not revoked. */
  deletedAt: string | null;
  /** UUID of the actor who executed the revocation. */
  deletedBy: string | null;
}

// ── Face Verification Result ───────────────────────────────────────────────────

/**
 * Result of a biometric verification attempt (POST /v1/face/verify).
 *
 * HTTP 200 is always returned for valid biometric results.
 * Error codes (4xx/5xx) are reserved for auth, tenant, and infrastructure failures.
 */
export type VerifyResult = "MATCH" | "POSSÍVEL" | "SEM_MATCH";

// ── Circuit Breaker ────────────────────────────────────────────────────────────

/** High-level AI Service availability status. */
export type AiServiceStatus = "ok" | "degraded" | "unavailable";

/** Technical state of the AI Service circuit breaker. */
export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";
