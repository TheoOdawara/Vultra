/**
 * VULTRA — Reports Repository
 *
 * Aggregation queries for attendance and wellbeing reporting (HR Portal).
 * All queries are tenant-scoped by organizationId.
 *
 * Design notes:
 * - Raw SQL via drizzle.execute() for complex aggregations
 * - Results never include face_embedding or PII beyond name (LGPD)
 * - Wellbeing alerts surface members with ≥ alertThreshold negative
 *   sentiment events in the observation window
 */

import { sql } from "drizzle-orm";
import type {
  AttendanceReportFilter,
  AttendanceReportRow,
  IReportsRepository,
  WellbeingAlert,
  WellbeingReportFilter,
  WellbeingReportRow,
} from "../../core/ports/IReportsRepository";
import type { Db } from "../../infrastructure/database/client";

const NEGATIVE_SENTIMENTS = ["sad", "angry", "fear", "disgust"];

export class ReportsRepository implements IReportsRepository {
  constructor(private readonly db: Db) {}

  /**
   * Attendance report: per-member summary of sessions attended vs. total sessions
   * within the date window, scoped to the tenant.
   */
  async getAttendanceReport(filter: AttendanceReportFilter): Promise<AttendanceReportRow[]> {
    const classFilter = filter.classId ? sql`AND s.class_id = ${filter.classId}::uuid` : sql``;

    const professorFilter = filter.professorId
      ? sql`AND s.professor_id = ${filter.professorId}::uuid`
      : sql``;

    const result = await this.db.execute(sql`
      WITH session_window AS (
        SELECT s.id AS session_id
        FROM attendance_sessions s
        WHERE s.organization_id = ${filter.organizationId}::uuid
          AND s.started_at BETWEEN ${filter.from.toISOString()} AND ${filter.to.toISOString()}
          ${classFilter}
          ${professorFilter}
      ),
      total_sessions AS (
        SELECT COUNT(*) AS total FROM session_window
      ),
      attended AS (
        SELECT
          r.member_id,
          COUNT(DISTINCT r.session_id) AS attended_count,
          MAX(r.recorded_at) AS last_attended_at
        FROM attendance_records r
        WHERE r.organization_id = ${filter.organizationId}::uuid
          AND r.session_id IN (SELECT session_id FROM session_window)
        GROUP BY r.member_id
      )
      SELECT
        m.id AS member_id,
        m.full_name AS member_name,
        m.role AS member_role,
        (SELECT total FROM total_sessions)::int AS total_sessions,
        COALESCE(a.attended_count, 0)::int AS attended_sessions,
        CASE
          WHEN (SELECT total FROM total_sessions) = 0 THEN 0
          ELSE ROUND(
            COALESCE(a.attended_count, 0)::numeric /
            (SELECT total FROM total_sessions)::numeric * 100, 2
          )
        END AS attendance_rate,
        a.last_attended_at
      FROM members m
      LEFT JOIN attended a ON a.member_id = m.id
      WHERE m.organization_id = ${filter.organizationId}::uuid
        AND m.is_active = TRUE
      ORDER BY m.full_name
    `);

    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        memberId: String(r.member_id),
        memberName: String(r.member_name),
        memberRole: String(r.member_role),
        totalSessions: Number(r.total_sessions),
        attendedSessions: Number(r.attended_sessions),
        attendanceRate: Number(r.attendance_rate),
        lastAttendedAt: r.last_attended_at ? new Date(String(r.last_attended_at)) : null,
      };
    });
  }

  /**
   * Wellbeing report: sentiment distribution per member over the date window.
   * Only sentiment-labelled records (from face recognition) are included.
   */
  async getWellbeingReport(filter: WellbeingReportFilter): Promise<WellbeingReportRow[]> {
    const result = await this.db.execute(sql`
      SELECT
        m.id AS member_id,
        m.full_name AS member_name,
        r.sentiment_label,
        COUNT(*) AS occurrences,
        ROUND(AVG(r.sentiment_score)::numeric, 4) AS avg_score,
        MAX(r.recorded_at) AS latest_at
      FROM attendance_records r
      JOIN members m ON m.id = r.member_id
      WHERE r.organization_id = ${filter.organizationId}::uuid
        AND r.recorded_at BETWEEN ${filter.from.toISOString()} AND ${filter.to.toISOString()}
        AND r.sentiment_label IS NOT NULL
        AND r.is_manual = FALSE
      GROUP BY m.id, m.full_name, r.sentiment_label
      ORDER BY m.full_name, occurrences DESC
    `);

    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        memberId: String(r.member_id),
        memberName: String(r.member_name),
        sentimentLabel: String(r.sentiment_label),
        occurrences: Number(r.occurrences),
        avgScore: Number(r.avg_score),
        latestAt: new Date(String(r.latest_at)),
      };
    });
  }

  /**
   * Wellbeing alerts: members whose negative sentiment exceeds the threshold.
   * Used by the HR portal to flag members who may need support.
   */
  async getWellbeingAlerts(filter: WellbeingReportFilter): Promise<WellbeingAlert[]> {
    const threshold = filter.alertThreshold ?? 3;
    const windowDays = Math.round(
      (filter.to.getTime() - filter.from.getTime()) / (1000 * 60 * 60 * 24)
    );

    const sentimentList = NEGATIVE_SENTIMENTS.map((s) => sql`${s}`).reduce((acc, s, i) =>
      i === 0 ? s : sql`${acc}, ${s}`
    );

    const result = await this.db.execute(sql`
      SELECT
        m.id AS member_id,
        m.full_name AS member_name,
        dominant.sentiment_label AS dominant_negative_sentiment,
        dominant.occurrences AS negative_occurrences
      FROM members m
      JOIN LATERAL (
        SELECT
          r.sentiment_label,
          COUNT(*) AS occurrences
        FROM attendance_records r
        WHERE r.member_id = m.id
          AND r.organization_id = ${filter.organizationId}::uuid
          AND r.recorded_at BETWEEN ${filter.from.toISOString()} AND ${filter.to.toISOString()}
          AND r.sentiment_label IN (${sentimentList})
          AND r.is_manual = FALSE
        GROUP BY r.sentiment_label
        ORDER BY occurrences DESC
        LIMIT 1
      ) dominant ON dominant.occurrences >= ${threshold}
      WHERE m.organization_id = ${filter.organizationId}::uuid
        AND m.is_active = TRUE
      ORDER BY dominant.occurrences DESC
    `);

    return result.rows.map((row) => {
      const r = row as Record<string, unknown>;
      return {
        memberId: String(r.member_id),
        memberName: String(r.member_name),
        dominantNegativeSentiment: String(r.dominant_negative_sentiment),
        negativeOccurrences: Number(r.negative_occurrences),
        observationWindowDays: windowDays,
      };
    });
  }
}
