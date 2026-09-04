import type {
  AttendanceSession,
  RecognitionMethod,
  SentimentLabel,
  SessionStatus,
} from "../domain.js";
import type { Collection, CursorQuery, SortDirection } from "../pagination.js";

export interface OpenSessionBody {
  classId: string;
  deviceId: string;
}

export type OpenSessionResponse = AttendanceSession;

export interface ListSessionsQuery extends CursorQuery {
  status?: SessionStatus;
  classId?: string;
  from?: string;
  to?: string;
  sort?: "startedAt";
  direction?: SortDirection;
}

export type ListSessionsResponse = Collection<AttendanceSession>;

export type GetSessionResponse = AttendanceSession;

export interface CloseSessionBody {
  status: "closed";
}

export type CloseSessionResponse = AttendanceSession;

export interface SessionAttendanceRecord {
  recordId: string;
  memberId: string;
  memberName: string;
  recognitionMethod: RecognitionMethod;
  confidenceScore: number;
  sentimentLabel: SentimentLabel | null;
  notes: string | null;
  recordedAt: string;
}

export type ListSessionRecordsResponse = Collection<SessionAttendanceRecord>;

export interface RecordAttendanceBody {
  frameBase64: string;
}

export type RecordAttendanceResponse = SessionAttendanceRecord;

export interface PutManualRecordBody {
  notes?: string;
}

export type PutManualRecordResponse = SessionAttendanceRecord;
