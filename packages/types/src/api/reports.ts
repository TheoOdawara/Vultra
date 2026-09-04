import type { SentimentLabel } from "../domain.js";

export interface AttendanceReportQuery {
  classId: string;
  from: string;
  to: string;
}

export interface AttendanceReportRow {
  memberId: string;
  memberName: string;
  present: number;
  absent: number;
  attendanceRate: number;
}

export interface AttendanceReportResponse {
  rows: AttendanceReportRow[];
  filter: AttendanceReportQuery;
  generatedAt: string;
}

export interface WellbeingReportQuery {
  classId?: string;
  professorId?: string;
  from: string;
  to: string;
}

export type WellbeingDistribution = Record<SentimentLabel, number | null>;

export interface WellbeingReportRow {
  classId: string | null;
  professorId: string | null;
  distribution: WellbeingDistribution;
  suppressed: boolean;
}

export interface WellbeingReportResponse {
  rows: WellbeingReportRow[];
  filter: WellbeingReportQuery;
  generatedAt: string;
}
