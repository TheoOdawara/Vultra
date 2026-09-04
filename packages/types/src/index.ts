export type {
  ActorType,
  AttendanceRecord,
  AttendanceSession,
  AuditLog,
  BiometricProfile,
  CircuitBreakerState,
  Class,
  Device,
  Enrollment,
  Member,
  MemberImport,
  MemberImportLineStatus,
  MemberImportResult,
  MemberImportStatus,
  MemberRole,
  RecognitionMethod,
  RetentionRun,
  SentimentLabel,
  SessionStatus,
  VerificationResult,
} from "./domain.js";

export type {
  ApiErrorBody,
  ApiErrorCode,
  ApiErrorDetail,
  ApiErrorPayload,
  KnownApiErrorCode,
} from "./errors.js";
export { API_ERROR_CODES, isKnownApiErrorCode } from "./errors.js";

export type { Collection, CursorQuery, PageInfo, SortDirection } from "./pagination.js";

export type {
  CreateMemberBody,
  CreateMemberResponse,
  GetMemberResponse,
  ListMembersQuery,
  ListMembersResponse,
  UpdateMemberBody,
  UpdateMemberResponse,
} from "./api/members.js";

export type {
  CreateMemberImportBody,
  CreateMemberImportResponse,
  GetMemberImportResponse,
} from "./api/member-imports.js";

export type {
  CreateClassBody,
  CreateClassResponse,
  GetClassResponse,
  ListClassesQuery,
  ListClassesResponse,
  ListEnrollmentsQuery,
  ListEnrollmentsResponse,
  PutEnrollmentResponse,
  UpdateClassBody,
  UpdateClassResponse,
} from "./api/classes.js";

export type {
  CreateDeviceBody,
  CreateDeviceKeyResponse,
  CreateDeviceResponse,
  GetDeviceResponse,
  ListDevicesQuery,
  ListDevicesResponse,
  UpdateDeviceBody,
  UpdateDeviceResponse,
} from "./api/devices.js";

export type {
  CreateBiometricProfileBody,
  CreateBiometricProfileResponse,
  CreateBiometricVerificationBody,
  CreateBiometricVerificationResponse,
  ListBiometricProfilesQuery,
  ListBiometricProfilesResponse,
} from "./api/biometrics.js";

export type {
  CloseSessionBody,
  CloseSessionResponse,
  GetSessionResponse,
  ListSessionRecordsResponse,
  ListSessionsQuery,
  ListSessionsResponse,
  OpenSessionBody,
  OpenSessionResponse,
  PutManualRecordBody,
  PutManualRecordResponse,
  RecordAttendanceBody,
  RecordAttendanceResponse,
  SessionAttendanceRecord,
} from "./api/attendance.js";

export type {
  AttendanceReportQuery,
  AttendanceReportResponse,
  AttendanceReportRow,
  WellbeingDistribution,
  WellbeingReportQuery,
  WellbeingReportResponse,
  WellbeingReportRow,
} from "./api/reports.js";

export type { ListAuditLogsQuery, ListAuditLogsResponse } from "./api/audit.js";

export type { CreateRetentionRunResponse } from "./api/retention.js";

export type { DependenciesHealthResponse, HealthResponse } from "./api/health.js";
