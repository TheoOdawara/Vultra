/**
 * VULTRA — Biometrics Use Cases
 *
 * EnrollBiometricUseCase  → POST /v1/biometric/enroll
 * RevokeBiometricUseCase  → DELETE /v1/biometric/:memberId
 *
 * Dependencies injected via constructor (hexagonal — no concrete imports).
 */

import type {
  BiometricProfileLookup,
  BiometricsRepository,
} from "../../adapters/repositories/biometrics.repo.ts";
import type {
  AuditActorType,
  AuditLogRepository,
} from "../../adapters/repositories/audit-log.repository.ts";
import type { IAIQueueAdapter } from "../ports/IAIQueueAdapter";
import { BiometricProfileNotFoundError, DomainError } from "../domain/errors/DomainError";

const CURRENT_MODEL_VERSION = "ArcFace-v1";
const FACE_MATCH_THRESHOLD = 0.85;
const POSSIBLE_MATCH_THRESHOLD = 0.75;

// ── Enroll ────────────────────────────────────────────────────────────────────

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
  private readonly MIN_QUALITY = 0.5;

  constructor(
    private readonly aiQueue: IAIQueueAdapter,
    private readonly biometricsRepo: BiometricsRepository,
    private readonly auditLogRepo: AuditLogRepository
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
        { errorCode: "LOW_QUALITY", httpStatus: 422 }
      );
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

// ── Verify ────────────────────────────────────────────────────────────────────

export interface VerifyFaceInput {
  jobId: string;
  frameBase64: string;
  memberId?: string;
  organizationId: string;
  actorId: string;
  actorType: AuditActorType;
  ipAddress?: string;
}

export interface VerifyFaceOutput {
  result: "MATCH" | "POSSÍVEL" | "SEM_MATCH";
  memberId?: string;
  confidence: number;
  processingMs: number;
}

export class VerifyFaceUseCase {
  constructor(
    private readonly aiQueue: IAIQueueAdapter,
    private readonly biometricsRepo: BiometricsRepository,
    private readonly auditLogRepo: AuditLogRepository
  ) {}

  async execute(input: VerifyFaceInput): Promise<VerifyFaceOutput> {
    if (input.memberId) {
      const memberProfiles = await this.biometricsRepo.findByOrgAndMember(
        input.organizationId,
        input.memberId
      );

      if (memberProfiles.length === 0) {
        await this.auditLogRepo.insert({
          organizationId: input.organizationId,
          actorId: input.actorId,
          actorType: input.actorType,
          action: "BIOMETRIC_PROFILE_VERIFIED",
          resourceType: "biometric_profiles",
          resourceId: null,
          payload: {
            requested_member_id: input.memberId,
            status: "NOT_FOUND",
          },
          ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
        });
        throw new DomainError("MEMBER_NOT_FOUND", 404, "Member not found in tenant");
      }
    }

    const aiResult = await this.aiQueue.enqueueAndAwait({
      jobId: input.jobId,
      frameBase64: input.frameBase64,
      organizationId: input.organizationId,
    });

    const match = await this.biometricsRepo.findBySimilarity(
      aiResult.embedding,
      input.organizationId,
      CURRENT_MODEL_VERSION,
      input.memberId
    );

    if (!match || match.similarity < POSSIBLE_MATCH_THRESHOLD) {
      await this.auditLogRepo.insert({
        organizationId: input.organizationId,
        actorId: input.actorId,
        actorType: input.actorType,
        action: "BIOMETRIC_PROFILE_VERIFIED",
        resourceType: "biometric_profiles",
        resourceId: null,
        payload: {
          result: "SEM_MATCH",
          confidence: 0,
          ...(input.memberId ? { requested_member_id: input.memberId } : {}),
        },
        ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      });

      return {
        result: "SEM_MATCH",
        confidence: 0,
        processingMs: aiResult.processingMs,
      };
    }

    if (match.similarity > FACE_MATCH_THRESHOLD) {
      await this.biometricsRepo.touchLastMatched(match.memberId, input.organizationId);

      await this.auditLogRepo.insert({
        organizationId: input.organizationId,
        actorId: input.actorId,
        actorType: input.actorType,
        action: "BIOMETRIC_PROFILE_VERIFIED",
        resourceType: "biometric_profiles",
        resourceId: match.profileId,
        payload: {
          result: "MATCH",
          confidence: match.similarity,
          ...(input.memberId ? { requested_member_id: input.memberId } : {}),
          matched_member_id: match.memberId,
          matched_profile_id: match.profileId,
        },
        ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
      });

      return {
        result: "MATCH",
        memberId: match.memberId,
        confidence: match.similarity,
        processingMs: aiResult.processingMs,
      };
    }

    await this.auditLogRepo.insert({
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: "BIOMETRIC_PROFILE_VERIFIED",
      resourceType: "biometric_profiles",
      resourceId: match.profileId,
      payload: {
        result: "POSSÍVEL",
        confidence: match.similarity,
        ...(input.memberId ? { requested_member_id: input.memberId } : {}),
        matched_member_id: match.memberId,
        matched_profile_id: match.profileId,
      },
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
    });

    return {
      result: "POSSÍVEL",
      memberId: match.memberId,
      confidence: match.similarity,
      processingMs: aiResult.processingMs,
    };
  }
}

// ── List ──────────────────────────────────────────────────────────────────────

export interface ListFacesInput {
  organizationId: string;
  memberId?: string;
}

export class ListFacesUseCase {
  constructor(private readonly biometricsRepo: BiometricsRepository) {}

  async execute(input: ListFacesInput): Promise<BiometricProfileLookup[]> {
    return this.biometricsRepo.findByOrgAndMember(input.organizationId, input.memberId);
  }
}

// ── Revoke ────────────────────────────────────────────────────────────────────

export interface RevokeBiometricInput {
  organizationId: string;
  profileId?: string;
  memberId?: string;
  deletedBy?: string;
  actorId: string;
  actorType: AuditActorType;
  ipAddress?: string;
}

export class RevokeBiometricUseCase {
  constructor(
    private readonly biometricsRepo: BiometricsRepository,
    private readonly auditLogRepo: AuditLogRepository
  ) {}

  async execute(input: RevokeBiometricInput): Promise<void> {
    const profile = await this.resolveProfile(input);

    const deletedBy = input.deletedBy ?? input.actorId ?? input.memberId;
    if (!deletedBy) {
      throw new BiometricProfileNotFoundError();
    }

    const revoked = await this.biometricsRepo.revoke(
      profile.profileId,
      input.organizationId,
      deletedBy
    );

    if (!revoked) {
      await this.insertNotFoundAuditLog(input);
      throw new BiometricProfileNotFoundError();
    }

    await this.auditLogRepo.insert({
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: "BIOMETRIC_PROFILE_REVOKED",
      resourceType: "biometric_profiles",
      resourceId: profile.profileId,
      payload: {
        profile_id: profile.profileId,
        member_id: profile.memberId,
        deleted_by: deletedBy,
      },
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
    });
  }

  private async resolveProfile(input: RevokeBiometricInput): Promise<BiometricProfileLookup> {
    if (input.profileId) {
      const profile = await this.biometricsRepo.findActiveProfileById(
        input.profileId,
        input.organizationId
      );

      if (!profile) {
        await this.insertNotFoundAuditLog(input);
        throw new BiometricProfileNotFoundError();
      }

      return profile;
    }

    if (!input.memberId) {
      await this.insertNotFoundAuditLog(input);
      throw new BiometricProfileNotFoundError();
    }

    const profiles = await this.biometricsRepo.findByOrgAndMember(
      input.organizationId,
      input.memberId
    );

    const activeProfile = profiles[0];
    if (!activeProfile) {
      await this.insertNotFoundAuditLog(input);
      throw new BiometricProfileNotFoundError();
    }

    return activeProfile;
  }

  private async insertNotFoundAuditLog(input: RevokeBiometricInput): Promise<void> {
    await this.auditLogRepo.insert({
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: "BIOMETRIC_PROFILE_REVOKED",
      resourceType: "biometric_profiles",
      resourceId: null,
      payload: {
        ...(input.profileId ? { requested_profile_id: input.profileId } : {}),
        ...(input.memberId ? { requested_member_id: input.memberId } : {}),
        status: "NOT_FOUND",
      },
      ...(input.ipAddress ? { ipAddress: input.ipAddress } : {}),
    });
  }
}
