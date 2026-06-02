import { describe, expect, it } from "bun:test";
import type {
  AttendanceReportFilter,
  IReportsRepository,
  WellbeingReportFilter,
} from "../../core/ports/IReportsRepository.ts";
import { GetAttendanceReportUseCase } from "../../core/use-cases/reports/GetAttendanceReportUseCase.ts";
import { GetWellbeingReportUseCase } from "../../core/use-cases/reports/GetWellbeingReportUseCase.ts";

function createReportsRepoStub(): IReportsRepository {
  return {
    async getAttendanceReport(_filter: AttendanceReportFilter) {
      return [];
    },
    async getWellbeingReport(_filter: WellbeingReportFilter) {
      return [];
    },
    async getWellbeingAlerts(_filter: WellbeingReportFilter) {
      return [];
    },
  };
}

function expectInvalidReportRange(error: unknown) {
  expect(error).toBeInstanceOf(Error);
  if (
    typeof error !== "object" ||
    error === null ||
    !("errorCode" in error) ||
    !("httpStatus" in error)
  ) {
    throw new Error("Erro INVALID_REPORT_RANGE não expõe errorCode/httpStatus");
  }

  const domainError = error as Record<"errorCode" | "httpStatus", unknown>;
  expect(domainError.errorCode).toBe("INVALID_REPORT_RANGE");
  expect(domainError.httpStatus).toBe(400);
}

describe("reports use cases", () => {
  it("GetAttendanceReportUseCase usa status HTTP canonico em INVALID_REPORT_RANGE", async () => {
    const useCase = new GetAttendanceReportUseCase(createReportsRepoStub());

    try {
      await useCase.execute({
        organizationId: "org-1",
        from: new Date("2026-02-01T00:00:00.000Z"),
        to: new Date("2026-01-01T00:00:00.000Z"),
      });
      throw new Error("INVALID_REPORT_RANGE não foi lançado");
    } catch (error) {
      expectInvalidReportRange(error);
    }
  });

  it("GetWellbeingReportUseCase usa status HTTP canonico em INVALID_REPORT_RANGE", async () => {
    const useCase = new GetWellbeingReportUseCase(createReportsRepoStub());

    try {
      await useCase.execute({
        organizationId: "org-1",
        from: new Date("2026-02-01T00:00:00.000Z"),
        to: new Date("2026-01-01T00:00:00.000Z"),
      });
      throw new Error("INVALID_REPORT_RANGE não foi lançado");
    } catch (error) {
      expectInvalidReportRange(error);
    }
  });
});
