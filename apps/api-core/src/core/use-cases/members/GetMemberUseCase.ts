/**
 * VULTRA — GetMemberUseCase
 *
 * GET /v1/members/:id
 * Retrieves a single member by ID, scoped to the tenant.
 */

import type { IMemberRepository, MemberSnapshot } from "../../ports/IMemberRepository";
import { MemberNotFoundError } from "./errors";

export { MemberNotFoundError };

export interface GetMemberInput {
  memberId: string;
  organizationId: string;
}

export class GetMemberUseCase {
  constructor(private readonly memberRepo: IMemberRepository) {}

  async execute(input: GetMemberInput): Promise<MemberSnapshot> {
    const member = await this.memberRepo.findById(input.memberId, input.organizationId);

    if (!member) throw new MemberNotFoundError();

    return member;
  }
}
