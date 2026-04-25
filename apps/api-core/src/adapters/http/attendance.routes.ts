/**
 * VULTRA — Attendance Routes
 *
 * POST   /v1/attendance/sessions                     → OpenSessionUseCase
 * PATCH  /v1/attendance/sessions/:id/close           → CloseSessionUseCase
 * POST   /v1/attendance/record                       → RecordAttendanceUseCase (ESP32)
 * POST   /v1/attendance/sessions/:id/records/manual  → ManualRecordUseCase
 *
 * /record uses deviceAuthPlugin (ESP32 auth via X-Device-Token).
 * All other routes use authPlugin (user session).
 */

import { createId } from "@paralleldrive/cuid2";
import Elysia, { t } from "elysia";
import { authPlugin } from "./auth.plugin";
import { deviceAuthPlugin } from "./device-auth.plugin";
import type { AIJobQueue } from "../queue/ai-job.queue.ts";
import { AttendanceRepository } from "../repositories/attendance.repo.ts";
import { BiometricsRepository } from "../repositories/biometrics.repo.ts";
import {
  CloseSessionUseCase,
  ManualRecordUseCase,
  OpenSessionUseCase,
  RecordAttendanceUseCase,
} from "../../core/use-cases/attendance.use-cases";
import { db } from "../../infrastructure/database/client";
import { OrganizationNotFoundError } from "../../core/domain/errors/DomainError";

let _aiQueue: AIJobQueue | null = null;

export function initAttendanceRoutes(aiQueue: AIJobQueue) {
  _aiQueue = aiQueue;
}

function getRepos() {
  return {
    attendance: new AttendanceRepository(db),
    biometrics: new BiometricsRepository(db),
  };
}

// ── User-authenticated routes ─────────────────────────────────────────────────

export const attendanceUserRoutes = new Elysia({ prefix: "/attendance" })
  .use(authPlugin)

  // POST /v1/attendance/sessions
  .post(
    "/sessions",
    async ({ body, currentOrg }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      const { attendance } = getRepos();
      const uc = new OpenSessionUseCase(attendance);
      const session = await uc.execute({
        organizationId: currentOrg,
        deviceId: body.deviceId,
        ...(body.classId && { classId: body.classId }),
        ...(body.professorId && { professorId: body.professorId }),
      });
      if (!session) throw new Error("Failed to create session");
      return { sessionId: session.id, status: session.status, startedAt: session.startedAt };
    },
    {
      body: t.Object({
        deviceId: t.String({ format: "uuid" }),
        classId: t.Optional(t.String({ format: "uuid" })),
        professorId: t.Optional(t.String({ format: "uuid" })),
      }),
      response: t.Object({
        sessionId: t.String(),
        status: t.String(),
        startedAt: t.Date(),
      }),
      detail: { summary: "Open attendance session", tags: ["attendance"] },
    }
  )

  // PATCH /v1/attendance/sessions/:id/close
  .patch(
    "/sessions/:id/close",
    async ({ params, currentOrg }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      const { attendance } = getRepos();
      const uc = new CloseSessionUseCase(attendance);
      await uc.execute({ sessionId: params.id, organizationId: currentOrg });
      return { success: true };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      response: t.Object({ success: t.Boolean() }),
      detail: { summary: "Close attendance session", tags: ["attendance"] },
    }
  )

  // POST /v1/attendance/sessions/:id/records/manual
  .post(
    "/sessions/:id/records/manual",
    async ({ params, body, currentOrg }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      const { attendance } = getRepos();
      const uc = new ManualRecordUseCase(attendance);
      const record = await uc.execute({
        sessionId: params.id,
        memberId: body.memberId,
        organizationId: currentOrg,
        ...(body.notes && { notes: body.notes }),
      });
      if (!record) throw new Error("Failed to create attendance record");
      return {
        recordId: record.id,
        memberId: record.memberId,
        recognitionMethod: record.recognitionMethod,
        recordedAt: record.recordedAt,
      };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: t.Object({
        memberId: t.String({ format: "uuid" }),
        notes: t.Optional(t.String({ maxLength: 500 })),
      }),
      response: t.Object({
        recordId: t.String(),
        memberId: t.String(),
        recognitionMethod: t.String(),
        recordedAt: t.Date(),
      }),
      detail: { summary: "Manual attendance override", tags: ["attendance"] },
    }
  );

// ── Device-authenticated routes ───────────────────────────────────────────────

export const attendanceDeviceRoutes = new Elysia({ prefix: "/attendance" })
  .use(deviceAuthPlugin)

  // POST /v1/attendance/record  (called by ESP32-CAM)
  .post(
    "/record",
    async ({ body, authenticatedDevice }) => {
      if (!_aiQueue) throw new Error("AIJobQueue not initialized");

      const { attendance, biometrics } = getRepos();
      const uc = new RecordAttendanceUseCase(_aiQueue, biometrics, attendance);

      const result = await uc.execute({
        jobId: createId(),
        frameBase64: body.frameBase64,
        sessionId: body.sessionId,
        organizationId: authenticatedDevice.organizationId,
        deviceId: authenticatedDevice.id,
      });

      return {
        recordId: result.recordId,
        memberId: result.memberId,
        confidenceScore: result.confidenceScore,
        sentimentLabel: result.sentimentLabel,
        sentimentScore: result.sentimentScore,
        recordedAt: result.recordedAt,
      };
    },
    {
      body: t.Object({
        sessionId: t.String({ format: "uuid" }),
        frameBase64: t.String({ minLength: 1, description: "JPEG frame — NEVER stored" }),
      }),
      response: t.Object({
        recordId: t.String(),
        memberId: t.String(),
        confidenceScore: t.Number({ minimum: 0, maximum: 1 }),
        sentimentLabel: t.Nullable(t.String()),
        sentimentScore: t.Nullable(t.Number({ minimum: 0, maximum: 1 })),
        recordedAt: t.Date(),
      }),
      detail: {
        summary: "Record attendance via ESP32-CAM (device auth)",
        tags: ["attendance"],
        description:
          "Accepts a JPEG frame from an ESP32-CAM, runs face recognition via AI Service, " +
          "and persists the attendance record. Frame is NEVER stored (LGPD Art. 11).",
      },
    }
  );
