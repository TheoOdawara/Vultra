/**
 * VULTRA — Attendance Use Cases Barrel
 *
 * Re-exports all attendance use cases for convenience.
 */

export type { CloseSessionInput } from "./CloseSessionUseCase";
export { CloseSessionUseCase } from "./CloseSessionUseCase";
export type { ManualRecordInput } from "./ManualRecordUseCase";
export { ManualRecordUseCase } from "./ManualRecordUseCase";
export type { OpenSessionInput } from "./OpenSessionUseCase";
export { OpenSessionUseCase } from "./OpenSessionUseCase";
export type {
  RecordAttendanceInput,
  RecordAttendanceOutput,
} from "./RecordAttendanceUseCase";
export { RecordAttendanceUseCase } from "./RecordAttendanceUseCase";
