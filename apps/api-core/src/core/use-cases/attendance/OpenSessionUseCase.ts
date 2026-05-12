/**
 * VULTRA — OpenSessionUseCase
 *
 * POST /v1/attendance/sessions
 */

import type { IAttendanceRepository, SessionSnapshot } from "../../ports/IAttendanceRepository";

export interface OpenSessionInput {
  organizationId: string;
  deviceId: string;
  classId?: string;
  professorId?: string;
}

export class OpenSessionUseCase {
  constructor(private readonly attendanceRepo: IAttendanceRepository) {}

  async execute(input: OpenSessionInput): Promise<SessionSnapshot | undefined> {
    return this.attendanceRepo.createSession({
      organizationId: input.organizationId,
      deviceId: input.deviceId,
      classId: input.classId ?? null,
      professorId: input.professorId ?? null,
      status: "open",
    });
  }
}
