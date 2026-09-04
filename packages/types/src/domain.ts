export type MemberRole = "gestor" | "professor" | "rh" | "student";

export interface Member {
  id: string;
  organizationId: string;
  userId: string | null;
  fullName: string;
  email: string | null;
  role: MemberRole;
  externalCode: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MemberImportStatus = "pending" | "running" | "completed" | "failed";

export type MemberImportLineStatus = "created" | "rejected";

export interface MemberImportResult {
  line: number;
  status: MemberImportLineStatus;
  memberId: string | null;
  errorCode: string | null;
}

export interface MemberImport {
  id: string;
  organizationId: string;
  status: MemberImportStatus;
  results: MemberImportResult[];
  createdAt: string;
  completedAt: string | null;
}

export interface Class {
  id: string;
  organizationId: string;
  name: string;
  code: string;
  professorId: string;
  isActive: boolean;
  enrollmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Enrollment {
  classId: string;
  memberId: string;
  enrolledAt: string;
}

export interface Device {
  id: string;
  organizationId: string;
  label: string;
  location: string | null;
  firmwareVersion: string | null;
  lastSeenAt: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type SessionStatus = "open" | "closed";

export interface AttendanceSession {
  id: string;
  organizationId: string;
  classId: string;
  deviceId: string;
  professorId: string;
  startedAt: string;
  endedAt: string | null;
  status: SessionStatus;
}

export type RecognitionMethod = "face" | "manual";

export type SentimentLabel =
  | "happy"
  | "neutral"
  | "sad"
  | "angry"
  | "surprise"
  | "fear"
  | "disgust";

export interface AttendanceRecord {
  id: string;
  organizationId: string;
  sessionId: string;
  memberId: string;
  recordedAt: string;
  confidenceScore: number;
  matchThreshold: number;
  recognitionMethod: RecognitionMethod;
  sentimentLabel: SentimentLabel | null;
  sentimentScore: number | null;
  notes: string | null;
}

export interface BiometricProfile {
  profileId: string;
  organizationId: string;
  memberId: string;
  modelVersion: string;
  qualityScore: number;
  isActive: boolean;
  enrolledAt: string;
  lastMatchedAt: string | null;
}

export type VerificationResult = "MATCH" | "POSSIBLE" | "NO_MATCH";

export type ActorType = "user" | "device";

export interface AuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  actorId: string;
  actorType: ActorType;
  ipAddress: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface RetentionRun {
  executedAt: string;
  deleted: {
    biometricProfiles: number;
    memberImports: number;
    attendanceRecords: number;
    auditLogs: number;
  };
  capped: boolean;
}

export type CircuitBreakerState = "CLOSED" | "OPEN" | "HALF_OPEN";
