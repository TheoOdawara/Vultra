/**
 * VULTRA — EnrollBiometricUseCase
 *
 * POST /v1/face/enroll
 * Processes a JPEG frame via AI Service and stores the 512-dim ArcFace embedding.
 * Frame is NEVER persisted (LGPD Art. 11).
 */

import type { IAIQueueAdapter } from "../../ports/IAIQueueAdapter";
import type { IBiometricRepository } from "../../ports/IBiometricRepository";
import type { IAuditLogRepository, AuditActorType } from "../../ports/IAuditLogRepository";
import { LowQualityFrameError } from "../../domain/errors/DomainError";
import { CURRENT_MODEL_VERSION, MIN_ENROLL_QUALITY } from "../../domain/constants";

export interface EnrollBiometricInput {
  jobId: string;
  frameBase64: string;
  memberId: string;
  organizationId: string;
  deviceId?: string;
  actorId: string;
  actorType: AuditActorType;
  ipAddress?: string;
}

export interface EnrollBiometricOutput {
  profileId: string;
  qualityScore: number;
  modelVersion: string;
  processingMs: number;
}

export class EnrollBiometricUseCase {
  constructor(
    private readonly aiQueue: IAIQueueAdapter,
    private readonly biometricsRepo: IBiometricRepository,
    private readonly auditLogRepo: IAuditLogRepository
  ) {}

  async execute(input: EnrollBiometricInput): Promise<EnrollBiometricOutput> {
    // 1. Send frame to AI Service → get embedding
    const aiResult = await this.aiQueue.enqueueAndAwait({
      jobId: input.jobId,
      frameBase64: input.frameBase64,
      organizationId: input.organizationId,
      ...(input.deviceId && { deviceId: input.deviceId }),
    });

    // 2. Quality gate (minimum enroll quality)
    if (aiResult.qualityScore < MIN_ENROLL_QUALITY) {
      throw new LowQualityFrameError(aiResult.qualityScore);
    }

    // 3. Persist embedding (existing active profile is deactivated inside repo)
    const profileId = await this.biometricsRepo.enroll({
      organizationId: input.organizationId,
      memberId: input.memberId,
      faceEmbedding: aiResult.embedding,
      qualityScore: aiResult.qualityScore,
      modelVersion: CURRENT_MODEL_VERSION,
    });

    await this.auditLogRepo.insert({
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: "BIOMETRIC_PROFILE_ENROLLED",
      resourceType: "biometric_profiles",
      resourceId: profileId,
      payload: {
        profile_id: profileId,
        member_id: input.memberId,
        quality_score: aiResult.qualityScore,
        model_version: CURRENT_MODEL_VERSION,
      },
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
    });

    return {
      profileId,
      qualityScore: aiResult.qualityScore,
      modelVersion: CURRENT_MODEL_VERSION,
      processingMs: aiResult.processingMs,
    };
  }
}
