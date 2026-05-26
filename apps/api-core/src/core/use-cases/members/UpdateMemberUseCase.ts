/**
 * VULTRA — UpdateMemberUseCase
 *
 * PATCH /v1/members/:id
 * Partial update of a member's profile (name, email, role, external code, userId).
 * Validates external code uniqueness within the tenant if it's being changed.
 */

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
}

export class UpdateMemberUseCase {
  constructor(private readonly memberRepo: IMemberRepository) {}

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

    return updated;
  }
}
