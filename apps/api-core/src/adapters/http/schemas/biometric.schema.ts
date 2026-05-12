/**
 * VULTRA — Biometric Routes TypeBox Schemas
 */

import { t } from "elysia";

// ── Enroll ────────────────────────────────────────────────────────────────────

export const BiometricEnrollBodySchema = t.Object({
  memberId: t.String({ format: "uuid", description: "UUID of the member to enroll" }),
  frameBase64: t.String({ minLength: 1, description: "JPEG frame as base64 — never stored" }),
});

export const BiometricEnrollResponseSchema = t.Object({
  profileId: t.String(),
  qualityScore: t.Number({ minimum: 0, maximum: 1 }),
  modelVersion: t.String(),
  processingMs: t.Number({ minimum: 0 }),
});

// ── Revoke ────────────────────────────────────────────────────────────────────

export const BiometricRevokeParamsSchema = t.Object({
  memberId: t.String({ format: "uuid" }),
});

export const BiometricRevokeResponseSchema = t.Object({ success: t.Boolean() });
