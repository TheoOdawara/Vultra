/**
 * VULTRA — UpdateMemberUseCase
 *
 * PATCH /v1/members/:id
 * Partial update of a member's profile (name, email, role, external code, userId).
 * Validates external code uniqueness within the tenant if it's being changed.
 *
 * LGPD: audit payload is minimal — email and userId are excluded (PII).
 */

import type { AuditActorType, IAuditLogRepository } from "../../ports/IAuditLogRepository";
import type { IMemberRepository, MemberRole, MemberSnapshot } from "../../ports/IMemberRepository";
import { MemberExternalCodeConflictError } from "./CreateMemberUseCase";
import { MemberNotFoundError } from "./GetMemberUseCase";

export interface UpdateMemberInput {
  memberId: string;
  organizationId: string;
  fullName?: string;
  email?: string | null;
  role?: MemberRole;
  externalCode?: string | null;
  userId?: string | null;
  actorId: string;
  actorType: AuditActorType;
}

export class UpdateMemberUseCase {
  constructor(
    private readonly memberRepo: IMemberRepository,
    private readonly auditLogRepo: IAuditLogRepository
  ) {}

  async execute(input: UpdateMemberInput): Promise<MemberSnapshot> {
    // Check external code uniqueness if it's changing
    if (input.externalCode) {
      const existing = await this.memberRepo.findByExternalCode(
        input.externalCode,
        input.organizationId
      );
      if (existing && existing.id !== input.memberId) {
        throw new MemberExternalCodeConflictError();
      }
    }

    const updated = await this.memberRepo.update(input.memberId, input.organizationId, {
      ...(input.fullName !== undefined && { fullName: input.fullName }),
      ...(input.email !== undefined && { email: input.email }),
      ...(input.role !== undefined && { role: input.role }),
      ...(input.externalCode !== undefined && { externalCode: input.externalCode }),
      ...(input.userId !== undefined && { userId: input.userId }),
    });

    if (!updated) throw new MemberNotFoundError();

    // Audit MEMBER_UPDATED — only changed non-PII fields; email and userId excluded
    await this.auditLogRepo.insert({
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: "MEMBER_UPDATED",
      resourceType: "members",
      resourceId: input.memberId,
      payload: {
        ...(input.fullName !== undefined && { full_name: input.fullName }),
        ...(input.role !== undefined && { role: input.role }),
        ...(input.externalCode !== undefined && { external_code: input.externalCode }),
      },
    });

    return updated;
  }
}
