/**
 * VULTRA — VerifyFaceUseCase
 *
 * POST /v1/face/verify
 * Verifies a face against stored biometric profiles and returns a match result.
 */

import type { IAIQueueAdapter } from "../../ports/IAIQueueAdapter";
import type { IBiometricRepository } from "../../ports/IBiometricRepository";
import type { IAuditLogRepository, AuditActorType } from "../../ports/IAuditLogRepository";
import { DomainError } from "../../domain/errors/DomainError";
import { CURRENT_MODEL_VERSION, FACE_MATCH_THRESHOLD } from "../../domain/constants";

const POSSIBLE_MATCH_THRESHOLD = 0.75;

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
    private readonly biometricsRepo: IBiometricRepository,
    private readonly auditLogRepo: IAuditLogRepository
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
