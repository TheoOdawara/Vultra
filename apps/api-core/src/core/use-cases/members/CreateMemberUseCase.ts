/**
 * VULTRA — CreateMemberUseCase
 *
 * POST /v1/members
 * Creates a new member within a tenant organization.
 * Validates external code uniqueness within the tenant (if provided).
 */

import { DomainError } from "../../domain/errors/DomainError";
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
}

export class CreateMemberUseCase {
  constructor(private readonly memberRepo: IMemberRepository) {}

  async execute(input: CreateMemberInput): Promise<MemberSnapshot> {
    // Ensure external code is unique within the tenant
    if (input.externalCode) {
      const existing = await this.memberRepo.findByExternalCode(
        input.externalCode,
        input.organizationId
      );
      if (existing) throw new MemberExternalCodeConflictError();
    }

    return this.memberRepo.create({
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      fullName: input.fullName,
      email: input.email ?? null,
      role: input.role,
      externalCode: input.externalCode ?? null,
    });
  }
}
