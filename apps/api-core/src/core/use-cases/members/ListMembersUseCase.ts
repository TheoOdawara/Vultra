/**
 * VULTRA — ListMembersUseCase
 *
 * GET /v1/members
 * Lists members of a tenant, with optional filters and pagination.
 */

import type {
  IMemberRepository,
  ListMembersFilter,
  MemberRole,
  MemberSnapshot,
} from "../../ports/IMemberRepository";

export interface ListMembersInput {
  organizationId: string;
  role?: MemberRole;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListMembersOutput {
  members: MemberSnapshot[];
  total: number;
}

export class ListMembersUseCase {
  constructor(private readonly memberRepo: IMemberRepository) {}

  async execute(input: ListMembersInput): Promise<ListMembersOutput> {
    const filter: ListMembersFilter = {
      organizationId: input.organizationId,
      ...(input.role !== undefined && { role: input.role }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.search && { search: input.search }),
      limit: input.limit ?? 50,
      offset: input.offset ?? 0,
    };

    const [membersList, total] = await Promise.all([
      this.memberRepo.list(filter),
      this.memberRepo.count({
        organizationId: filter.organizationId,
        ...(filter.role !== undefined && { role: filter.role }),
        ...(filter.isActive !== undefined && { isActive: filter.isActive }),
        ...(filter.search && { search: filter.search }),
      }),
    ]);

    return { members: membersList, total };
  }
}
