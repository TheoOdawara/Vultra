/**
 * VULTRA — DeactivateMemberUseCase
 *
 * DELETE /v1/members/:id
 * Soft-deactivates a member (LGPD: data is retained, not deleted).
 * Sets is_active = FALSE and records deleted_at timestamp.
 *
 * Biometric revocation is coordinated at the route layer (DELETE /v1/members/:id)
 * so that the biometric audit trail is emitted by RevokeBiometricUseCase itself,
 * keeping domain boundaries clean.
 */

import type { AuditActorType, IAuditLogRepository } from "../../ports/IAuditLogRepository";
import type { IMemberRepository } from "../../ports/IMemberRepository";
import { MemberNotFoundError } from "./errors";

export interface DeactivateMemberInput {
  memberId: string;
  organizationId: string;
  actorId: string;
  actorType: AuditActorType;
}

export class DeactivateMemberUseCase {
  constructor(
    private readonly memberRepo: IMemberRepository,
    private readonly auditLogRepo: IAuditLogRepository
  ) {}

  async execute(input: DeactivateMemberInput): Promise<void> {
    const deactivated = await this.memberRepo.deactivate(input.memberId, input.organizationId);

    if (!deactivated) throw new MemberNotFoundError();

    await this.auditLogRepo.insert({
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: "MEMBER_DEACTIVATED",
      resourceType: "members",
      resourceId: input.memberId,
      payload: {
        member_id: input.memberId,
      },
    });
  }
}
