/**
 * VULTRA — GetMemberUseCase
 *
 * GET /v1/members/:id
 * Retrieves a single member by ID, scoped to the tenant.
 */

import { DomainError } from "../../domain/errors/DomainError";
import type { IMemberRepository, MemberSnapshot } from "../../ports/IMemberRepository";

export class MemberNotFoundError extends DomainError {
  constructor() {
    super("MEMBER_NOT_FOUND", 404, "Member not found");
  }
}

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
