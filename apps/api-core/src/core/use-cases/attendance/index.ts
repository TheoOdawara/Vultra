/**
 * VULTRA — Attendance Use Cases Barrel
 *
 * Re-exports all attendance use cases for convenience.
 */

export { RecordAttendanceUseCase } from "./RecordAttendanceUseCase";
export type {
  RecordAttendanceInput,
  RecordAttendanceOutput,
} from "./RecordAttendanceUseCase";

export { OpenSessionUseCase } from "./OpenSessionUseCase";
export type { OpenSessionInput } from "./OpenSessionUseCase";

export { CloseSessionUseCase } from "./CloseSessionUseCase";
export type { CloseSessionInput } from "./CloseSessionUseCase";

export { ManualRecordUseCase } from "./ManualRecordUseCase";
export type { ManualRecordInput } from "./ManualRecordUseCase";
