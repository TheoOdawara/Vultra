/**
 * VULTRA — Face/Biometric API Types
 *
 * Contracts for /v1/face/* (canonical biometric surface since ADR-006).
 * The legacy /v1/biometric/* surface is discontinued — all routes return 404.
 */

import type { BiometricProfile, VerifyResult } from "../domain.js";

// ── Enroll ─────────────────────────────────────────────────────────────────────

/**
 * Body for `POST /v1/face/enroll`
 *
 * LGPD: `frameBase64` is processed entirely in RAM. Never stored anywhere.
 */
export interface EnrollBody {
  memberId: string;
  /** JPEG frame encoded as Base64. Never persisted (LGPD Art. 11). */
  frameBase64: string;
}

/** HTTP 201 */
export interface EnrollResponse {
  profileId: string;
  /** Quality score of the enrolled frame [0, 1]. */
  qualityScore: number;
  /** Model used for embedding (e.g., "ArcFace-v1"). */
  modelVersion: string;
  /** Server-side processing time in milliseconds. */
  processingMs: number;
}

// ── Verify ─────────────────────────────────────────────────────────────────────

/**
 * Body for `POST /v1/face/verify`
 *
 * LGPD: `frameBase64` is processed entirely in RAM. Never stored anywhere.
 */
export interface VerifyBody {
  /** JPEG frame encoded as Base64. Never persisted (LGPD Art. 11). */
  frameBase64: string;
  /** Optional filter: restrict search to profiles of this member (1:N within tenant). */
  memberId?: string;
}

/**
 * HTTP 200 — always returned for valid biometric attempts.
 *
 * `result` semantics:
 * - `MATCH` — similarity above the configured threshold (default 0.85)
 * - `POSSÍVEL` — similarity in the soft-match zone (configurable per tenant)
 * - `SEM_MATCH` — no match found above minimum threshold
 *
 * 4xx/5xx codes are reserved for auth, tenant, and infrastructure failures.
 */
export interface VerifyResponse {
  result: VerifyResult;
  /** The matched member's ID. Absent when result is SEM_MATCH. */
  memberId?: string;
  /** Best cosine similarity score achieved [0, 1]. */
  confidence: number;
  processingMs: number;
}

// ── List Profiles ──────────────────────────────────────────────────────────────

export interface ListFacesQuery {
  /** Filter by member ID. */
  memberId?: string;
}

/** HTTP 200 */
export type ListFacesResponse = BiometricProfile[];

// ── Delete / Revoke ────────────────────────────────────────────────────────────

/**
 * HTTP 200 for `DELETE /v1/face/:profileId`
 *
 * Revokes the biometric profile:
 *   - `face_embedding` is set to NULL (data inutilized per LGPD Art. 18, VI)
 *   - `is_active` is set to FALSE
 *   - `deleted_at` / `deleted_by` are recorded in the audit log
 */
export interface DeleteFaceResponse {
  success: boolean;
}
