/**
 * VULTRA — Reports Use Cases Barrel
 */

export { InvalidReportRangeError } from "../../domain/errors/DomainError";
export type {
  GetAttendanceReportInput,
  GetAttendanceReportOutput,
} from "./GetAttendanceReportUseCase";
export { GetAttendanceReportUseCase } from "./GetAttendanceReportUseCase";
export type {
  GetWellbeingReportInput,
  GetWellbeingReportOutput,
} from "./GetWellbeingReportUseCase";
export { GetWellbeingReportUseCase } from "./GetWellbeingReportUseCase";
