/**
 * VULTRA — Attendance Repository
 *
 * Handles database operations for attendance_sessions and attendance_records.
 * All queries include organization_id filter (multitenancy).
 */

import { and, eq } from "drizzle-orm";
import type {
  NewAttendanceRecord,
  NewAttendanceSession,
} from "../../infrastructure/database/schema";
import type { Db } from "../../infrastructure/database/client";
import { attendanceRecords, attendanceSessions } from "../../infrastructure/database/schema";
import type {
  IAttendanceRepository,
  SessionSnapshot,
  AttendanceRecordSnapshot,
  NewSessionData,
  NewRecordData,
  ManualRecordParams,
} from "../../core/ports/IAttendanceRepository";

export class AttendanceRepository implements IAttendanceRepository {
  constructor(private readonly db: Db) {}

  // ── Sessions ──────────────────────────────────────────────────────────────

  async findSessionById(
    sessionId: string,
    organizationId: string
  ): Promise<SessionSnapshot | null> {
    const [session] = await this.db
      .select()
      .from(attendanceSessions)
      .where(
        and(
          eq(attendanceSessions.id, sessionId),
          eq(attendanceSessions.organizationId, organizationId)
        )
      )
      .limit(1);
    return session ?? null;
  }

  async createSession(data: NewSessionData): Promise<SessionSnapshot | undefined> {
    const [session] = await this.db
      .insert(attendanceSessions)
      .values(data as NewAttendanceSession)
      .returning();
    return session;
  }

  async closeSession(sessionId: string, organizationId: string): Promise<void> {
    await this.db
      .update(attendanceSessions)
      .set({ status: "closed", endedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(attendanceSessions.id, sessionId),
          eq(attendanceSessions.organizationId, organizationId)
        )
      );
  }

  // ── Records ───────────────────────────────────────────────────────────────

  /**
   * Check if a member already has a presence record in this session.
   * Returns true if duplicate (HTTP 409 should follow).
   */
  async existsRecord(sessionId: string, memberId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: attendanceRecords.id })
      .from(attendanceRecords)
      .where(
        and(eq(attendanceRecords.sessionId, sessionId), eq(attendanceRecords.memberId, memberId))
      )
      .limit(1);
    return !!row;
  }

  async createRecord(data: NewRecordData): Promise<AttendanceRecordSnapshot | undefined> {
    const [record] = await this.db
      .insert(attendanceRecords)
      .values(data as NewAttendanceRecord)
      .returning();
    return record;
  }

  async createManualRecord(
    params: ManualRecordParams
  ): Promise<AttendanceRecordSnapshot | undefined> {
    return this.createRecord({
      sessionId: params.sessionId,
      memberId: params.memberId,
      organizationId: params.organizationId,
      confidenceScore: 1.0,
      matchThreshold: 0,
      recognitionMethod: "manual",
      isManual: true,
    });
  }
}
