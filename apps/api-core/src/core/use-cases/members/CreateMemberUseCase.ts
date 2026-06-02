/**
 * VULTRA — CreateMemberUseCase
 *
 * POST /v1/members
 * Creates a new member within a tenant organization.
 * Validates external code uniqueness within the tenant (if provided).
 *
 * LGPD: audit payload is minimal — email is intentionally excluded (PII).
 */

import { DomainError } from "../../domain/errors/DomainError";
import type { AuditActorType, IAuditLogRepository } from "../../ports/IAuditLogRepository";
import type { IMemberRepository, MemberRole, MemberSnapshot } from "../../ports/IMemberRepository";

export class MemberExternalCodeConflictError extends DomainError {
  constructor() {
    super(
      "MEMBER_EXTERNAL_CODE_CONFLICT",
      409,
      "A member with this external code already exists in the organization"
    );
  }
}

export interface CreateMemberInput {
  organizationId: string;
  userId?: string | null | undefined;
  fullName: string;
  email?: string | null | undefined;
  role: MemberRole;
  externalCode?: string | null | undefined;
  actorId: string;
  actorType: AuditActorType;
}

export class CreateMemberUseCase {
  constructor(
    private readonly memberRepo: IMemberRepository,
    private readonly auditLogRepo: IAuditLogRepository
  ) {}

  async execute(input: CreateMemberInput): Promise<MemberSnapshot> {
    // Ensure external code is unique within the tenant
    if (input.externalCode) {
      const existing = await this.memberRepo.findByExternalCode(
        input.externalCode,
        input.organizationId
      );
      if (existing) throw new MemberExternalCodeConflictError();
    }

    const member = await this.memberRepo.create({
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      fullName: input.fullName,
      email: input.email ?? null,
      role: input.role,
      externalCode: input.externalCode ?? null,
    });

    // Audit MEMBER_CREATED — email intentionally excluded (PII)
    await this.auditLogRepo.insert({
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: "MEMBER_CREATED",
      resourceType: "members",
      resourceId: member.id,
      payload: {
        full_name: member.fullName,
        role: member.role,
        external_code: member.externalCode,
      },
    });

    return member;
  }
}
