/**
 * VULTRA — Face Routes TypeBox Schemas
 */

import { t } from "elysia";

export const PROFILE_ID_PATTERN =
  "^(?:profile-[0-9]+|profile-[a-z0-9]+(?:-[a-z0-9]+)+|[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})$";

// ── Enroll ────────────────────────────────────────────────────────────────────

export const EnrollBodySchema = t.Object(
  {
    memberId: t.String({ format: "uuid" }),
    frameBase64: t.String({ minLength: 1 }),
  },
  { additionalProperties: false }
);

export const EnrollResponseSchema = {
  201: t.Object({
    profileId: t.String(),
    qualityScore: t.Number({ minimum: 0, maximum: 1 }),
    modelVersion: t.String(),
    processingMs: t.Number({ minimum: 0 }),
  }),
};

// ── Verify ────────────────────────────────────────────────────────────────────

export const VerifyBodySchema = t.Object(
  {
    frameBase64: t.String({ minLength: 1 }),
    memberId: t.Optional(t.String({ format: "uuid" })),
  },
  { additionalProperties: false }
);

export const VerifyResponseSchema = t.Object({
  result: t.Union([t.Literal("MATCH"), t.Literal("POSSÍVEL"), t.Literal("SEM_MATCH")]),
  memberId: t.Optional(t.String()),
  confidence: t.Number({ minimum: 0, maximum: 1 }),
  processingMs: t.Number({ minimum: 0 }),
});

// ── List ──────────────────────────────────────────────────────────────────────

export const ListFacesQuerySchema = t.Object(
  {
    memberId: t.Optional(t.String({ format: "uuid" })),
  },
  { additionalProperties: false }
);

export const ListFacesResponseSchema = t.Array(
  t.Object({
    profileId: t.String(),
    organizationId: t.String(),
    memberId: t.String(),
    modelVersion: t.String(),
    qualityScore: t.Number({ minimum: 0, maximum: 1 }),
    isActive: t.Boolean(),
    deviceId: t.Nullable(t.String()),
    createdBy: t.Nullable(t.String()),
    enrolledAt: t.String(),
    lastMatchedAt: t.Nullable(t.String()),
    deletedAt: t.Nullable(t.String()),
    deletedBy: t.Nullable(t.String()),
  })
);

// ── Delete ────────────────────────────────────────────────────────────────────

export const DeleteFaceParamsSchema = t.Object({
  profileId: t.String({ pattern: PROFILE_ID_PATTERN }),
});

export const DeleteFaceResponseSchema = t.Object({ success: t.Boolean() });
