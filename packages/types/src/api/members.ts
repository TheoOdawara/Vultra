import type { Member, MemberRole } from "../domain.js";
import type { Collection, CursorQuery, SortDirection } from "../pagination.js";

export interface ListMembersQuery extends CursorQuery {
  role?: MemberRole;
  isActive?: boolean;
  search?: string;
  sort?: "fullName" | "createdAt";
  direction?: SortDirection;
}

export type ListMembersResponse = Collection<Member>;

export interface CreateMemberBody {
  fullName: string;
  email?: string;
  role: MemberRole;
  externalCode?: string;
}

export type CreateMemberResponse = Member;

export type GetMemberResponse = Member;

export interface UpdateMemberBody {
  fullName?: string;
  email?: string | null;
  role?: MemberRole;
  externalCode?: string | null;
}

export type UpdateMemberResponse = Member;
