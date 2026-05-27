/**
 * VULTRA — Attendance API Types
 *
 * Contracts for /v1/attendance/sessions and /v1/attendance/records
 */

import type { SentimentLabel } from "../domain.js";

// ── Open Session ───────────────────────────────────────────────────────────────

export interface OpenSessionBody {
  deviceId: string;
  classId?: string;
  professorId?: string;
}

/** HTTP 201 */
export interface OpenSessionResponse {
  sessionId: string;
  status: string;
  /** ISO 8601 */
  startedAt: string;
}

// ── Close Session ──────────────────────────────────────────────────────────────

/** HTTP 200 */
export interface CloseSessionResponse {
  success: boolean;
}

// ── Manual Record ─────────────────────────────────────────────────────────────

export interface ManualRecordBody {
  memberId: string;
  notes?: string;
}

/** HTTP 201 */
export interface ManualRecordResponse {
  recordId: string;
  memberId: string;
  recognitionMethod: string;
  /** ISO 8601 */
  recordedAt: string;
}

// ── List Session Records ───────────────────────────────────────────────────────

export interface SessionAttendanceRecord {
  recordId: string;
  memberId: string;
  memberName: string;
  recognitionMethod: string;
  confidenceScore: number;
  sentimentLabel: string | null;
  /** ISO 8601 */
  recordedAt: string;
}

/** HTTP 200 for `GET /v1/attendance/sessions/:id/records` */
export interface ListSessionRecordsResponse {
  records: SessionAttendanceRecord[];
}

// ── Device Record (Face Recognition) ─────────────────────────────────────────

/**
 * Body for `POST /v1/attendance/record`
 *
 * LGPD: `frameBase64` is processed entirely in RAM by the AI Service.
 * It is NEVER stored anywhere — not in the API Core, not in the AI Service,
 * not in any log.
 */
export interface RecordAttendanceBody {
  sessionId: string;
  /** JPEG frame encoded as Base64. Never persisted. */
  frameBase64: string;
}

/** HTTP 201 */
export interface RecordAttendanceResponse {
  recordId: string;
  memberId: string;
  /** Cosine similarity [0, 1] */
  confidenceScore: number;
  sentimentLabel: SentimentLabel | null;
  /** Sentiment confidence [0, 1] */
  sentimentScore: number | null;
  /** ISO 8601 */
  recordedAt: string;
}
