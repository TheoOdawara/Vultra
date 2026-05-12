/**
 * VULTRA — RevokeBiometricUseCase
 *
 * DELETE /v1/face/:profileId
 * Soft-revokes a biometric profile (LGPD Art. 18, VI).
 * Sets is_active = FALSE, nullifies the embedding vector.
 */

import type {
  IBiometricRepository,
  BiometricProfileLookup,
} from "../../ports/IBiometricRepository";
import type { IAuditLogRepository, AuditActorType } from "../../ports/IAuditLogRepository";
import { BiometricProfileNotFoundError } from "../../domain/errors/DomainError";

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
    private readonly biometricsRepo: IBiometricRepository,
    private readonly auditLogRepo: IAuditLogRepository
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
