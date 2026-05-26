/**
 * VULTRA — DeactivateMemberUseCase
 *
 * DELETE /v1/members/:id
 * Soft-deactivates a member (LGPD: data is retained, not deleted).
 * Sets is_active = FALSE and records deleted_at timestamp.
 */

import type { IMemberRepository } from "../../ports/IMemberRepository";
import { MemberNotFoundError } from "./GetMemberUseCase";

export interface DeactivateMemberInput {
  memberId: string;
  organizationId: string;
}

export class DeactivateMemberUseCase {
  constructor(private readonly memberRepo: IMemberRepository) {}

  async execute(input: DeactivateMemberInput): Promise<void> {
    const deactivated = await this.memberRepo.deactivate(input.memberId, input.organizationId);

    if (!deactivated) throw new MemberNotFoundError();
  }
}
