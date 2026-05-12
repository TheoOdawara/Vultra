/**
 * VULTRA — Attendance TypeBox Schemas
 */

import { t } from "elysia";

// ── Session schemas ───────────────────────────────────────────────────────────

export const OpenSessionBodySchema = t.Object({
  deviceId: t.String({ format: "uuid" }),
  classId: t.Optional(t.String({ format: "uuid" })),
  professorId: t.Optional(t.String({ format: "uuid" })),
});

export const OpenSessionResponseSchema = t.Object({
  sessionId: t.String(),
  status: t.String(),
  startedAt: t.Date(),
});

export const CloseSessionParamsSchema = t.Object({ id: t.String({ format: "uuid" }) });

export const CloseSessionResponseSchema = t.Object({ success: t.Boolean() });

// ── Manual record schemas ─────────────────────────────────────────────────────

export const ManualRecordParamsSchema = t.Object({ id: t.String({ format: "uuid" }) });

export const ManualRecordBodySchema = t.Object({
  memberId: t.String({ format: "uuid" }),
  notes: t.Optional(t.String({ maxLength: 500 })),
});

export const ManualRecordResponseSchema = t.Object({
  recordId: t.String(),
  memberId: t.String(),
  recognitionMethod: t.String(),
  recordedAt: t.Date(),
});

// ── Device record schemas ─────────────────────────────────────────────────────

export const RecordAttendanceBodySchema = t.Object({
  sessionId: t.String({ format: "uuid" }),
  frameBase64: t.String({ minLength: 1, description: "JPEG frame — NEVER stored" }),
});

export const RecordAttendanceResponseSchema = t.Object({
  recordId: t.String(),
  memberId: t.String(),
  confidenceScore: t.Number({ minimum: 0, maximum: 1 }),
  sentimentLabel: t.Nullable(t.String()),
  sentimentScore: t.Nullable(t.Number({ minimum: 0, maximum: 1 })),
  recordedAt: t.Date(),
});
