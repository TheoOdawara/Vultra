/**
 * VULTRA — ManualRecordUseCase
 *
 * POST /v1/attendance/sessions/:id/records/manual
 */

import {
  AttendanceConflictError,
  SessionAlreadyClosedError,
  SessionNotFoundError,
} from "../../domain/errors/DomainError";
import type {
  AttendanceRecordSnapshot,
  IAttendanceRepository,
} from "../../ports/IAttendanceRepository";

export interface ManualRecordInput {
  sessionId: string;
  memberId: string;
  organizationId: string;
  notes?: string;
}

export class ManualRecordUseCase {
  constructor(private readonly attendanceRepo: IAttendanceRepository) {}

  async execute(input: ManualRecordInput): Promise<AttendanceRecordSnapshot | undefined> {
    const session = await this.attendanceRepo.findSessionById(
      input.sessionId,
      input.organizationId
    );
    if (!session) throw new SessionNotFoundError();
    if (session.status !== "open") throw new SessionAlreadyClosedError();

    const isDuplicate = await this.attendanceRepo.existsRecord(
      input.sessionId,
      input.memberId,
      input.organizationId
    );
    if (isDuplicate) throw new AttendanceConflictError();

    return this.attendanceRepo.createManualRecord({
      sessionId: input.sessionId,
      memberId: input.memberId,
      organizationId: input.organizationId,
      ...(input.notes && { notes: input.notes }),
    });
  }
}
