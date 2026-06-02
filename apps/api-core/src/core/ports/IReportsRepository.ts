/**
 * VULTRA — IReportsRepository Port
 *
 * Contract consumed by Reports Use Cases.
 * Handles aggregation queries for attendance and wellbeing reporting.
 */

// ── Domain types ──────────────────────────────────────────────────────────────

export interface AttendanceReportRow {
  memberId: string;
  memberName: string;
  memberRole: string;
  totalSessions: number;
  attendedSessions: number;
  attendanceRate: number;
  lastAttendedAt: Date | null;
}

export interface WellbeingReportRow {
  memberId: string;
  memberName: string;
  sentimentLabel: string;
  occurrences: number;
  avgScore: number;
  latestAt: Date;
}

export interface WellbeingAlert {
  memberId: string;
  memberName: string;
  dominantNegativeSentiment: string;
  negativeOccurrences: number;
  observationWindowDays: number;
}

// ── Filter types ──────────────────────────────────────────────────────────────

export interface AttendanceReportFilter {
  organizationId: string;
  from: Date;
  to: Date;
  classId?: string;
  professorId?: string;
}

export interface WellbeingReportFilter {
  organizationId: string;
  from: Date;
  to: Date;
  /** Minimum negative-sentiment occurrences to surface in alerts */
  alertThreshold?: number;
}

// ── Port interface ────────────────────────────────────────────────────────────

export interface IReportsRepository {
  getAttendanceReport(filter: AttendanceReportFilter): Promise<AttendanceReportRow[]>;
  getWellbeingReport(filter: WellbeingReportFilter): Promise<WellbeingReportRow[]>;
  getWellbeingAlerts(filter: WellbeingReportFilter): Promise<WellbeingAlert[]>;
}
