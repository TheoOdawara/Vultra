/**
 * VULTRA — Reports API Types
 *
 * Contracts for GET /v1/reports/attendance and GET /v1/reports/wellbeing
 */

// ── Attendance Report ─────────────────────────────────────────────────────────

export interface AttendanceReportQuery {
  /** ISO 8601 date-time — start of period */
  from: string;
  /** ISO 8601 date-time — end of period */
  to: string;
  classId?: string;
  /**
   * Filter by professor ID. Admin/RH can pass any professorId.
   * Professors are automatically scoped to their own sessions (enforced by API).
   */
  professorId?: string;
}

/** Per-member row in the attendance report. */
export interface AttendanceReportRow {
  memberId: string;
  memberName: string;
  memberRole: string;
  totalSessions: number;
  attendedSessions: number;
  /** Attendance rate as a percentage [0, 100]. */
  attendanceRate: number;
  /** ISO 8601 or null if member never attended. */
  lastAttendedAt: string | null;
}

export interface AttendanceReportFilter {
  from: string;
  to: string;
  classId?: string;
  professorId?: string;
}

/** HTTP 200 */
export interface AttendanceReportResponse {
  rows: AttendanceReportRow[];
  /** ISO 8601 timestamp of report generation. */
  generatedAt: string;
  filter: AttendanceReportFilter;
}

// ── Wellbeing Report ───────────────────────────────────────────────────────────

export interface WellbeingReportQuery {
  /** ISO 8601 date-time — start of period */
  from: string;
  /** ISO 8601 date-time — end of period */
  to: string;
  /**
   * Minimum negative-sentiment events per member to surface an alert.
   * Defaults to 3.
   */
  alertThreshold?: number;
}

/** Per-member, per-sentiment-label row in the wellbeing breakdown. */
export interface WellbeingRow {
  memberId: string;
  memberName: string;
  sentimentLabel: string;
  occurrences: number;
  /** Average sentiment confidence for this label [0, 1]. */
  avgScore: number;
  /** ISO 8601 — most recent occurrence of this label for this member. */
  latestAt: string;
}

/** Alert record for a member with elevated negative sentiment in the period. */
export interface WellbeingAlert {
  memberId: string;
  memberName: string;
  dominantNegativeSentiment: string;
  negativeOccurrences: number;
  observationWindowDays: number;
}

export interface WellbeingReportFilter {
  from: string;
  to: string;
  alertThreshold: number;
}

/**
 * HTTP 200
 *
 * LGPD: Only aggregated sentiment metadata is returned.
 * No frames, embeddings, or per-recognition raw data are exposed.
 */
export interface WellbeingReportResponse {
  sentimentBreakdown: WellbeingRow[];
  alerts: WellbeingAlert[];
  /** ISO 8601 timestamp of report generation. */
  generatedAt: string;
  filter: WellbeingReportFilter;
}
