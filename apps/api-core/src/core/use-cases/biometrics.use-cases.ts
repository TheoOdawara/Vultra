/**
 * VULTRA — Biometrics Use Cases
 *
 * EnrollBiometricUseCase  → POST /v1/biometric/enroll
 * RevokeBiometricUseCase  → DELETE /v1/biometric/:memberId
 *
 * Dependencies injected via constructor (hexagonal — no concrete imports).
 */

import type { BiometricsRepository } from "../../adapters/repositories/biometrics.repo.ts";
import type { IAIQueueAdapter } from "../ports/IAIQueueAdapter";
import { AIServiceUnavailableError } from "../domain/errors/DomainError";

// ── Enroll ────────────────────────────────────────────────────────────────────

export interface EnrollBiometricInput {
  jobId: string;
  frameBase64: string;
  memberId: string;
  organizationId: string;
  deviceId?: string;
}

export interface EnrollBiometricOutput {
  profileId: string;
  qualityScore: number;
  modelVersion: string;
  processingMs: number;
}

export class EnrollBiometricUseCase {
  private readonly MODEL_VERSION = "ArcFace-v1";
  private readonly MIN_QUALITY = 0.5;

  constructor(
    private readonly aiQueue: IAIQueueAdapter,
    private readonly biometricsRepo: BiometricsRepository,
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
    if (aiResult.qualityScore < this.MIN_QUALITY) {
      throw Object.assign(
        new Error(`Quality score ${aiResult.qualityScore} below minimum ${this.MIN_QUALITY}`),
        { errorCode: "LOW_QUALITY", httpStatus: 422 },
      );
    }

    // 3. Persist embedding (existing active profile is deactivated inside repo)
    const profileId = await this.biometricsRepo.enroll({
      organizationId: input.organizationId,
      memberId: input.memberId,
      faceEmbedding: aiResult.embedding,
      qualityScore: aiResult.qualityScore,
      modelVersion: this.MODEL_VERSION,
    });

    return {
      profileId,
      qualityScore: aiResult.qualityScore,
      modelVersion: this.MODEL_VERSION,
      processingMs: aiResult.processingMs,
    };
  }
}

// ── Revoke ────────────────────────────────────────────────────────────────────

export interface RevokeBiometricInput {
  memberId: string;
  organizationId: string;
}

export class RevokeBiometricUseCase {
  constructor(private readonly biometricsRepo: BiometricsRepository) {}

  async execute(input: RevokeBiometricInput): Promise<void> {
    await this.biometricsRepo.revoke(input.memberId, input.organizationId);
  }
}
