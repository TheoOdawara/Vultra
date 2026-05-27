/**
 * VULTRA — Reports Routes
 *
 * GET /v1/reports/attendance   → GetAttendanceReportUseCase
 * GET /v1/reports/wellbeing    → GetWellbeingReportUseCase
 *
 * Auth: authPlugin
 * RBAC:
 *   admin → all reports
 *   rh    → all reports
 *   professor → attendance report only (filtered to own sessions)
 *   student → forbidden
 *
 * LGPD: no biometric embedding or raw frame data is included in any response.
 */

import Elysia, { t } from "elysia";
import { ForbiddenError, InvalidReportRangeError, OrganizationNotFoundError } from "../../../core/domain/errors/DomainError";
import { GetAttendanceReportUseCase } from "../../../core/use-cases/reports/GetAttendanceReportUseCase";
import { GetWellbeingReportUseCase } from "../../../core/use-cases/reports/GetWellbeingReportUseCase";
import { checkPermission } from "../../../infrastructure/auth";
import { db } from "../../../infrastructure/database/client";
import { ReportsRepository } from "../../repositories/reports.repository";
import { authPlugin } from "../middleware/auth.plugin";

// ── Singletons ────────────────────────────────────────────────────────────────

let _attendanceReport: GetAttendanceReportUseCase | null = null;
let _wellbeingReport: GetWellbeingReportUseCase | null = null;

export function initReportRoutes(): void {
  const reportsRepo = new ReportsRepository(db);
  _attendanceReport = new GetAttendanceReportUseCase(reportsRepo);
  _wellbeingReport = new GetWellbeingReportUseCase(reportsRepo);
}

// ── TypeBox schemas ───────────────────────────────────────────────────────────

const AttendanceReportRowSchema = t.Object({
  memberId: t.String(),
  memberName: t.String(),
  memberRole: t.String(),
  totalSessions: t.Number({ minimum: 0 }),
  attendedSessions: t.Number({ minimum: 0 }),
  attendanceRate: t.Number({ minimum: 0, maximum: 100 }),
  lastAttendedAt: t.Nullable(t.String()),
});

const WellbeingRowSchema = t.Object({
  memberId: t.String(),
  memberName: t.String(),
  sentimentLabel: t.String(),
  occurrences: t.Number({ minimum: 1 }),
  avgScore: t.Number({ minimum: 0, maximum: 1 }),
  latestAt: t.String(),
});

const WellbeingAlertSchema = t.Object({
  memberId: t.String(),
  memberName: t.String(),
  dominantNegativeSentiment: t.String(),
  negativeOccurrences: t.Number({ minimum: 1 }),
  observationWindowDays: t.Number({ minimum: 1 }),
});

// ── Route tree ────────────────────────────────────────────────────────────────

export const reportRoutes = new Elysia({ prefix: "/reports" })
  .use(authPlugin)

  // GET /v1/reports/attendance
  .get(
    "/attendance",
    async ({ query, currentOrg, currentRole, currentUser }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_attendanceReport) throw new Error("ReportRoutes not initialized");

      const canRead = checkPermission(currentRole, { reports: ["read"] });
      const isProfessor = currentRole === "professor";

      if (!canRead && !isProfessor) throw new ForbiddenError();

      const from = new Date(query.from);
      const to = new Date(query.to);

      if (from >= to) throw new InvalidReportRangeError();

      // Professors are limited to sessions they ran
      const professorId =
        isProfessor && !canRead ? (currentUser?.id ?? undefined) : (query.professorId ?? undefined);

      const result = await _attendanceReport.execute({
        organizationId: currentOrg,
        from,
        to,
        ...(query.classId && { classId: query.classId }),
        ...(professorId && { professorId }),
      });

      return {
        rows: result.rows.map((r) => ({
          ...r,
          lastAttendedAt: r.lastAttendedAt?.toISOString() ?? null,
        })),
        generatedAt: result.generatedAt.toISOString(),
        filter: result.filter,
      };
    },
    {
      query: t.Object({
        from: t.String({ format: "date-time", description: "ISO 8601 start date" }),
        to: t.String({ format: "date-time", description: "ISO 8601 end date" }),
        classId: t.Optional(t.String({ format: "uuid" })),
        professorId: t.Optional(t.String({ format: "uuid" })),
      }),
      response: t.Object({
        rows: t.Array(AttendanceReportRowSchema),
        generatedAt: t.String(),
        filter: t.Object({
          from: t.String(),
          to: t.String(),
          classId: t.Optional(t.String()),
          professorId: t.Optional(t.String()),
        }),
      }),
      detail: {
        summary: "Attendance report",
        description:
          "Per-member attendance statistics. " +
          "Admin/RH see all members; professors see members from their own sessions.",
        tags: ["reports"],
      },
    }
  )

  // GET /v1/reports/wellbeing
  .get(
    "/wellbeing",
    async ({ query, currentOrg, currentRole }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_wellbeingReport) throw new Error("ReportRoutes not initialized");

      // Wellbeing data is restricted to admin and RH roles
      if (!checkPermission(currentRole, { reports: ["read"] })) throw new ForbiddenError();

      const from = new Date(query.from);
      const to = new Date(query.to);

      if (from >= to) throw new InvalidReportRangeError();

      const result = await _wellbeingReport.execute({
        organizationId: currentOrg,
        from,
        to,
        ...(query.alertThreshold !== undefined && { alertThreshold: query.alertThreshold }),
      });

      return {
        sentimentBreakdown: result.sentimentBreakdown.map((r) => ({
          ...r,
          latestAt: r.latestAt.toISOString(),
        })),
        alerts: result.alerts,
        generatedAt: result.generatedAt.toISOString(),
        filter: result.filter,
      };
    },
    {
      query: t.Object({
        from: t.String({ format: "date-time" }),
        to: t.String({ format: "date-time" }),
        alertThreshold: t.Optional(
          t.Integer({
            minimum: 1,
            description: "Minimum negative-sentiment events to surface an alert (default: 3)",
          })
        ),
      }),
      response: t.Object({
        sentimentBreakdown: t.Array(WellbeingRowSchema),
        alerts: t.Array(WellbeingAlertSchema),
        generatedAt: t.String(),
        filter: t.Object({
          from: t.String(),
          to: t.String(),
          alertThreshold: t.Number({ minimum: 1 }),
        }),
      }),
      detail: {
        summary: "Wellbeing report (HR only)",
        description:
          "Sentiment distribution and alerts for HR-level wellbeing monitoring. " +
          "LGPD: Only aggregated sentiment labels are returned — no raw frames or embeddings.",
        tags: ["reports"],
      },
    }
  );
