/**
 * VULTRA — CloseSessionUseCase
 *
 * PATCH /v1/attendance/sessions/:id/close
 */

import { SessionAlreadyClosedError, SessionNotFoundError } from "../../domain/errors/DomainError";
import type { IAttendanceRepository } from "../../ports/IAttendanceRepository";

export interface CloseSessionInput {
  sessionId: string;
  organizationId: string;
}

export class CloseSessionUseCase {
  constructor(private readonly attendanceRepo: IAttendanceRepository) {}

  async execute(input: CloseSessionInput): Promise<void> {
    const session = await this.attendanceRepo.findSessionById(
      input.sessionId,
      input.organizationId
    );
    if (!session) throw new SessionNotFoundError();
    if (session.status !== "open") throw new SessionAlreadyClosedError();

    await this.attendanceRepo.closeSession(input.sessionId, input.organizationId);
  }
}
