/**
 * @vultra/types — Shared TypeScript contract for VULTRA frontends
 *
 * All types here are derived from the API Core contracts (TypeBox schemas in
 * `apps/api-core/src/adapters/http/`). When the API changes, update this
 * package to match before updating the frontends.
 *
 * Usage:
 *   import type { Member, AttendanceRecord } from "@vultra/types";
 *   import type { CreateMemberBody, ListMembersResponse } from "@vultra/types/api/members";
 *
 * @packageDocumentation
 */

// ── Domain entities ───────────────────────────────────────────────────────────

export type {
  MemberRole,
  Member,
  Device,
  SessionStatus,
  AttendanceSession,
  RecognitionMethod,
  SentimentLabel,
  AttendanceRecord,
  BiometricProfile,
  VerifyResult,
  AiServiceStatus,
  CircuitBreakerState,
} from "./domain.js";

// ── Error types ───────────────────────────────────────────────────────────────

export type {
  ApiError,
  AuthErrorCode,
  MemberErrorCode,
  DeviceErrorCode,
  AttendanceErrorCode,
  BiometricErrorCode,
  ReportErrorCode,
  AiServiceErrorCode,
  KnownErrorCode,
  AiUnavailableError,
} from "./errors.js";

export { isKnownError } from "./errors.js";

// ── API request/response contracts ────────────────────────────────────────────

export type {
  ListMembersQuery,
  ListMembersResponse,
  CreateMemberBody,
  CreateMemberResponse,
  GetMemberResponse,
  UpdateMemberBody,
  UpdateMemberResponse,
  DeactivateMemberResponse,
} from "./api/members.js";

export type {
  ListDevicesQuery,
  ListDevicesResponse,
  RegisterDeviceBody,
  RegisterDeviceResponse,
  UpdateDeviceBody,
  UpdateDeviceResponse,
  RotateDeviceKeyResponse,
  DeactivateDeviceResponse,
} from "./api/devices.js";

export type {
  OpenSessionBody,
  OpenSessionResponse,
  CloseSessionResponse,
  ManualRecordBody,
  ManualRecordResponse,
  SessionAttendanceRecord,
  ListSessionRecordsResponse,
  RecordAttendanceBody,
  RecordAttendanceResponse,
} from "./api/attendance.js";

export type {
  EnrollBody,
  EnrollResponse,
  VerifyBody,
  VerifyResponse,
  ListFacesQuery,
  ListFacesResponse,
  DeleteFaceResponse,
} from "./api/face.js";

export type {
  AttendanceReportQuery,
  AttendanceReportRow,
  AttendanceReportFilter,
  AttendanceReportResponse,
  WellbeingReportQuery,
  WellbeingRow,
  WellbeingAlert,
  WellbeingReportFilter,
  WellbeingReportResponse,
} from "./api/reports.js";

export type { AiServiceHealthResponse } from "./api/health.js";
