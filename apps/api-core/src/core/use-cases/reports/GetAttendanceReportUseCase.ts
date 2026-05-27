/**
 * VULTRA — GetAttendanceReportUseCase
 *
 * GET /v1/reports/attendance
 * Returns per-member attendance statistics for a date window.
 * Used by the HR Portal and Professor Portal.
 */

import { InvalidReportRangeError } from "../../domain/errors/DomainError";
import type {
  AttendanceReportFilter,
  AttendanceReportRow,
  IReportsRepository,
} from "../../ports/IReportsRepository";

export interface GetAttendanceReportInput {
  organizationId: string;
  from: Date;
  to: Date;
  classId?: string;
  professorId?: string;
}

export interface GetAttendanceReportOutput {
  rows: AttendanceReportRow[];
  generatedAt: Date;
  filter: {
    from: string;
    to: string;
    classId?: string;
    professorId?: string;
  };
}

export class GetAttendanceReportUseCase {
  constructor(private readonly reportsRepo: IReportsRepository) {}

  async execute(input: GetAttendanceReportInput): Promise<GetAttendanceReportOutput> {
    if (input.from >= input.to) throw new InvalidReportRangeError();

    const filter: AttendanceReportFilter = {
      organizationId: input.organizationId,
      from: input.from,
      to: input.to,
      ...(input.classId && { classId: input.classId }),
      ...(input.professorId && { professorId: input.professorId }),
    };

    const rows = await this.reportsRepo.getAttendanceReport(filter);

    return {
      rows,
      generatedAt: new Date(),
      filter: {
        from: input.from.toISOString(),
        to: input.to.toISOString(),
        ...(input.classId && { classId: input.classId }),
        ...(input.professorId && { professorId: input.professorId }),
      },
    };
  }
}
