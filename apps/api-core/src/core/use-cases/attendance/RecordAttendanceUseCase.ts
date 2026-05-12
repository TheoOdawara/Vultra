/**
 * VULTRA — RecordAttendanceUseCase
 *
 * POST /v1/attendance/record (via ESP32 device)
 * Coordinates: AI queue → vector search → duplicate check → persist
 */

import type { IAIQueueAdapter } from "../../ports/IAIQueueAdapter";
import type { IBiometricRepository } from "../../ports/IBiometricRepository";
import type { IAttendanceRepository } from "../../ports/IAttendanceRepository";
import {
  AttendanceConflictError,
  FaceNotRecognizedError,
  LowConfidenceMatchError,
  SessionAlreadyClosedError,
  SessionNotFoundError,
} from "../../domain/errors/DomainError";
import {
  CURRENT_MODEL_VERSION,
  FACE_MATCH_THRESHOLD,
  LOW_CONFIDENCE_THRESHOLD,
} from "../../domain/constants";

export interface RecordAttendanceInput {
  jobId: string;
  frameBase64: string;
  sessionId: string;
  organizationId: string;
  deviceId: string;
}

export interface RecordAttendanceOutput {
  recordId: string;
  memberId: string;
  confidenceScore: number;
  sentimentLabel: string | null;
  sentimentScore: number | null;
  recordedAt: Date;
}

export class RecordAttendanceUseCase {
  constructor(
    private readonly aiQueue: IAIQueueAdapter,
    private readonly biometricsRepo: IBiometricRepository,
    private readonly attendanceRepo: IAttendanceRepository
  ) {}

  async execute(input: RecordAttendanceInput): Promise<RecordAttendanceOutput> {
    // 1. Verify session exists and is open
    const session = await this.attendanceRepo.findSessionById(
      input.sessionId,
      input.organizationId
    );
    if (!session) throw new SessionNotFoundError();
    if (session.status !== "open") throw new SessionAlreadyClosedError();

    // 2. Send frame to AI Service → embedding
    const aiResult = await this.aiQueue.enqueueAndAwait({
      jobId: input.jobId,
      frameBase64: input.frameBase64,
      organizationId: input.organizationId,
      deviceId: input.deviceId,
    });

    // 3. Vector similarity search in pgvector
    const match = await this.biometricsRepo.findBySimilarity(
      aiResult.embedding,
      input.organizationId,
      CURRENT_MODEL_VERSION
    );

    if (!match) throw new FaceNotRecognizedError();

    // 4. Confidence thresholding
    if (match.similarity < LOW_CONFIDENCE_THRESHOLD) {
      throw new FaceNotRecognizedError();
    }

    if (match.similarity < FACE_MATCH_THRESHOLD) {
      throw new LowConfidenceMatchError(match.similarity);
    }

    // 5. Duplicate check — same member cannot be registered twice in same session
    const isDuplicate = await this.attendanceRepo.existsRecord(input.sessionId, match.memberId);
    if (isDuplicate) throw new AttendanceConflictError();

    // 6. Persist attendance record (no image — only metadata and scores)
    const record = await this.attendanceRepo.createRecord({
      organizationId: input.organizationId,
      sessionId: input.sessionId,
      memberId: match.memberId,
      confidenceScore: match.similarity,
      matchThreshold: FACE_MATCH_THRESHOLD,
      recognitionMethod: "face",
      isManual: false,
    });
    if (!record) throw new Error("Failed to create attendance record");

    // 7. Update last_matched_at on biometric profile (non-blocking)
    this.biometricsRepo.touchLastMatched(match.memberId, input.organizationId).catch(() => {}); // fire-and-forget, don't fail the response

    return {
      recordId: record.id,
      memberId: match.memberId,
      confidenceScore: match.similarity,
      sentimentLabel: record.sentimentLabel ?? null,
      sentimentScore: record.sentimentScore ?? null,
      recordedAt: record.recordedAt,
    };
  }
}
