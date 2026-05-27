/**
 * VULTRA — Attendance Repository
 *
 * Handles database operations for attendance_sessions and attendance_records.
 * All queries run inside withTenantContext to activate RLS for the tenant.
 * Application-level organizationId filters are kept as defense-in-depth.
 */

import { and, eq } from "drizzle-orm";
import type {
  AttendanceRecordSnapshot,
  IAttendanceRepository,
  ManualRecordParams,
  NewRecordData,
  NewSessionData,
  SessionRecordRow,
  SessionSnapshot,
} from "../../core/ports/IAttendanceRepository";
import { withTenantContext } from "../../infrastructure/database/client";
import type { Db, Tx } from "../../infrastructure/database/client";
import type {
  NewAttendanceRecord,
  NewAttendanceSession,
} from "../../infrastructure/database/schema";
import { attendanceRecords, attendanceSessions, members } from "../../infrastructure/database/schema";

export class AttendanceRepository implements IAttendanceRepository {
  constructor(private readonly db: Db) {}

  // ── Sessions ──────────────────────────────────────────────────────────────

  async findSessionById(
    sessionId: string,
    organizationId: string
  ): Promise<SessionSnapshot | null> {
    return withTenantContext(this.db, organizationId, async (tx: Tx) => {
      const [session] = await tx
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
    });
  }

  async createSession(data: NewSessionData): Promise<SessionSnapshot | undefined> {
    return withTenantContext(this.db, data.organizationId, async (tx: Tx) => {
      const [session] = await tx
        .insert(attendanceSessions)
        .values(data as NewAttendanceSession)
        .returning();
      return session;
    });
  }

  async closeSession(sessionId: string, organizationId: string): Promise<void> {
    await withTenantContext(this.db, organizationId, async (tx: Tx) => {
      await tx
        .update(attendanceSessions)
        .set({ status: "closed", endedAt: new Date(), updatedAt: new Date() })
        .where(
          and(
            eq(attendanceSessions.id, sessionId),
            eq(attendanceSessions.organizationId, organizationId)
          )
        );
    });
  }

  // ── Records ───────────────────────────────────────────────────────────────

  /**
   * Check if a member already has a presence record in this session.
   * Returns true if duplicate (HTTP 409 should follow).
   */
  async existsRecord(
    sessionId: string,
    memberId: string,
    organizationId: string
  ): Promise<boolean> {
    return withTenantContext(this.db, organizationId, async (tx: Tx) => {
      const [row] = await tx
        .select({ id: attendanceRecords.id })
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.sessionId, sessionId),
            eq(attendanceRecords.memberId, memberId),
            eq(attendanceRecords.organizationId, organizationId)
          )
        )
        .limit(1);
      return !!row;
    });
  }

  async createRecord(data: NewRecordData): Promise<AttendanceRecordSnapshot | undefined> {
    return withTenantContext(this.db, data.organizationId, async (tx: Tx) => {
      const [record] = await tx
        .insert(attendanceRecords)
        .values(data as NewAttendanceRecord)
        .returning();
      return record;
    });
  }

  /**
   * Inlined instead of delegating to createRecord to avoid nested transactions.
   * Both methods have their own withTenantContext scope.
   */
  async createManualRecord(
    params: ManualRecordParams
  ): Promise<AttendanceRecordSnapshot | undefined> {
    return withTenantContext(this.db, params.organizationId, async (tx: Tx) => {
      const [record] = await tx
        .insert(attendanceRecords)
        .values({
          sessionId: params.sessionId,
          memberId: params.memberId,
          organizationId: params.organizationId,
          confidenceScore: 1.0,
          matchThreshold: 0,
          recognitionMethod: "manual",
          isManual: true,
        } as NewAttendanceRecord)
        .returning();
      return record;
    });
  }

  async listRecordsBySession(
    sessionId: string,
    organizationId: string
  ): Promise<SessionRecordRow[]> {
    return withTenantContext(this.db, organizationId, async (tx: Tx) => {
      const rows = await tx
        .select({
          recordId: attendanceRecords.id,
          memberId: attendanceRecords.memberId,
          memberName: members.fullName,
          recognitionMethod: attendanceRecords.recognitionMethod,
          confidenceScore: attendanceRecords.confidenceScore,
          sentimentLabel: attendanceRecords.sentimentLabel,
          recordedAt: attendanceRecords.recordedAt,
        })
        .from(attendanceRecords)
        .innerJoin(members, eq(attendanceRecords.memberId, members.id))
        .where(
          and(
            eq(attendanceRecords.sessionId, sessionId),
            eq(attendanceRecords.organizationId, organizationId)
          )
        )
        .orderBy(attendanceRecords.recordedAt);
      return rows;
    });
  }
}
