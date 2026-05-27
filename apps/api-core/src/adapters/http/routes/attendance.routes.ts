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
 *
 * RBAC:
 *   attendance:write → required for POST /sessions, PATCH .../close, POST .../manual
 *   Only admin (members:manage) may set an arbitrary professorId; other roles
 *   must omit it to prevent privilege escalation through false attribution.
 */

import { createId } from "@paralleldrive/cuid2";
import Elysia, { t } from "elysia";
import {
  ForbiddenError,
  OrganizationNotFoundError,
} from "../../../core/domain/errors/DomainError";
import { CloseSessionUseCase } from "../../../core/use-cases/attendance/CloseSessionUseCase";
import { ManualRecordUseCase } from "../../../core/use-cases/attendance/ManualRecordUseCase";
import { OpenSessionUseCase } from "../../../core/use-cases/attendance/OpenSessionUseCase";
import { RecordAttendanceUseCase } from "../../../core/use-cases/attendance/RecordAttendanceUseCase";
import { checkPermission } from "../../../infrastructure/auth";
import { db } from "../../../infrastructure/database/client";
import type { AIJobQueue } from "../../queue/ai-job.queue.ts";
import { AttendanceRepository } from "../../repositories/attendance.repository";
import { BiometricsRepository } from "../../repositories/biometric.repository";
import { MemberRepository } from "../../repositories/member.repository";
import { authPlugin } from "../middleware/auth.plugin";
import { deviceAuthPlugin } from "../middleware/device-auth.plugin";

// ── Singletons (built once when initAttendanceRoutes is called) ───────────────

let _openSession: OpenSessionUseCase | null = null;
let _closeSession: CloseSessionUseCase | null = null;
let _manualRecord: ManualRecordUseCase | null = null;
let _recordAttendance: RecordAttendanceUseCase | null = null;
let _memberRepo: MemberRepository | null = null;
let _attendanceRepo: AttendanceRepository | null = null;

export function initAttendanceRoutes(aiQueue: AIJobQueue): void {
  _attendanceRepo = new AttendanceRepository(db);
  const biometricsRepo = new BiometricsRepository(db);
  _memberRepo = new MemberRepository(db);

  _openSession = new OpenSessionUseCase(_attendanceRepo);
  _closeSession = new CloseSessionUseCase(_attendanceRepo);
  _manualRecord = new ManualRecordUseCase(_attendanceRepo);
  _recordAttendance = new RecordAttendanceUseCase(aiQueue, biometricsRepo, _attendanceRepo);
}

// ── User-authenticated routes ─────────────────────────────────────────────────

export const attendanceUserRoutes = new Elysia({ prefix: "/attendance" })
  .use(authPlugin)

  // POST /v1/attendance/sessions
  .post(
    "/sessions",
    async ({ body, currentOrg, currentRole, currentUser }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_openSession) throw new Error("AttendanceRoutes not initialized");
      if (!_memberRepo) throw new Error("AttendanceRoutes not initialized");

      // Only roles with attendance:write can open sessions (professors, admins — not students)
      if (!checkPermission(currentRole, { attendance: ["write"] })) throw new ForbiddenError();

      let professorId = body.professorId;
      const canManageMembers = checkPermission(currentRole, { members: ["manage"] });

      if (!canManageMembers) {
        const professorMember = await _memberRepo.findByUserId(currentUser.id, currentOrg);

        if (!professorMember || professorMember.role !== "professor") {
          throw new ForbiddenError();
        }

        if (professorId && professorId !== professorMember.id) {
          throw new ForbiddenError();
        }

        professorId = professorMember.id;
      }

      const session = await _openSession.execute({
        organizationId: currentOrg,
        deviceId: body.deviceId,
        ...(body.classId && { classId: body.classId }),
        ...(professorId && { professorId }),
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
      detail: {
        summary: "Open attendance session",
        description:
          "Requires attendance:write. Admin may set professorId freely; professors are bound to their own member id.",
        tags: ["attendance"],
      },
    }
  )

  // GET /v1/attendance/sessions/:id/records
  .get(
    "/sessions/:id/records",
    async ({ params, currentOrg, currentRole }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_attendanceRepo) throw new Error("AttendanceRoutes not initialized");

      if (!checkPermission(currentRole, { attendance: ["read"] })) throw new ForbiddenError();

      const rows = await _attendanceRepo.listRecordsBySession(params.id, currentOrg);

      return {
        records: rows.map((r) => ({
          ...r,
          recordedAt: r.recordedAt.toISOString(),
        })),
      };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      response: t.Object({
        records: t.Array(
          t.Object({
            recordId: t.String(),
            memberId: t.String(),
            memberName: t.String(),
            recognitionMethod: t.String(),
            confidenceScore: t.Number({ minimum: 0, maximum: 1 }),
            sentimentLabel: t.Nullable(t.String()),
            recordedAt: t.String(),
          })
        ),
      }),
      detail: { summary: "List session attendance records", tags: ["attendance"] },
    }
  )

  // PATCH /v1/attendance/sessions/:id/close
  .patch(
    "/sessions/:id/close",
    async ({ params, currentOrg, currentRole }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_closeSession) throw new Error("AttendanceRoutes not initialized");

      if (!checkPermission(currentRole, { attendance: ["write"] })) throw new ForbiddenError();

      await _closeSession.execute({ sessionId: params.id, organizationId: currentOrg });
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
    async ({ params, body, currentOrg, currentRole }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_manualRecord) throw new Error("AttendanceRoutes not initialized");

      if (!checkPermission(currentRole, { attendance: ["write"] })) throw new ForbiddenError();

      const record = await _manualRecord.execute({
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
      if (!_recordAttendance) throw new Error("AttendanceRoutes not initialized");

      const result = await _recordAttendance.execute({
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
