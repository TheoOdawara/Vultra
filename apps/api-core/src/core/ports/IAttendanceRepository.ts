/**
 * VULTRA — IAttendanceRepository Port
 *
 * Contract consumed by Attendance Use Cases.
 * Implementations live in adapters/repositories/.
 * Use Cases NEVER import concrete classes.
 */

// ── Domain snapshots (what use cases need) ────────────────────────────────────

export interface SessionSnapshot {
  id: string;
  status: string;
  startedAt: Date;
}

export interface AttendanceRecordSnapshot {
  id: string;
  memberId: string;
  sentimentLabel: string | null;
  sentimentScore: number | null;
  recognitionMethod: string;
  recordedAt: Date;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface NewSessionData {
  organizationId: string;
  deviceId: string;
  classId?: string | null;
  professorId?: string | null;
  status: string;
}

export interface NewRecordData {
  organizationId: string;
  sessionId: string;
  memberId: string;
  confidenceScore: number;
  matchThreshold: number;
  recognitionMethod: "face" | "manual";
  isManual: boolean;
}

export interface ManualRecordParams {
  sessionId: string;
  memberId: string;
  organizationId: string;
  notes?: string;
}

// ── Port interface ────────────────────────────────────────────────────────────

export interface IAttendanceRepository {
  findSessionById(sessionId: string, organizationId: string): Promise<SessionSnapshot | null>;
  createSession(data: NewSessionData): Promise<SessionSnapshot | undefined>;
  closeSession(sessionId: string, organizationId: string): Promise<void>;
  existsRecord(sessionId: string, memberId: string): Promise<boolean>;
  createRecord(data: NewRecordData): Promise<AttendanceRecordSnapshot | undefined>;
  createManualRecord(params: ManualRecordParams): Promise<AttendanceRecordSnapshot | undefined>;
}
