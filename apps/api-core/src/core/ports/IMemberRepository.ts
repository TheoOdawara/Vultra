/**
 * VULTRA — IMemberRepository Port
 *
 * Contract consumed by Member Use Cases.
 * Implementations live in adapters/repositories/.
 * Use Cases NEVER import concrete classes.
 */

// ── Domain snapshots ──────────────────────────────────────────────────────────

export type MemberRole = "admin" | "professor" | "rh" | "student";

export interface MemberSnapshot {
  id: string;
  organizationId: string;
  userId: string | null;
  fullName: string;
  email: string | null;
  role: MemberRole;
  externalCode: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateMemberData {
  organizationId: string;
  userId?: string | null;
  fullName: string;
  email?: string | null;
  role: MemberRole;
  externalCode?: string | null;
}

export interface UpdateMemberData {
  fullName?: string;
  email?: string | null;
  role?: MemberRole;
  externalCode?: string | null;
  userId?: string | null;
}

export interface ListMembersFilter {
  organizationId: string;
  role?: MemberRole;
  isActive?: boolean;
  /** Full-text search on fullName or email */
  search?: string;
  limit?: number;
  offset?: number;
}

// ── Port interface ────────────────────────────────────────────────────────────

export interface IMemberRepository {
  findById(memberId: string, organizationId: string): Promise<MemberSnapshot | null>;
  findByUserId(userId: string, organizationId: string): Promise<MemberSnapshot | null>;
  findByExternalCode(externalCode: string, organizationId: string): Promise<MemberSnapshot | null>;
  list(filter: ListMembersFilter): Promise<MemberSnapshot[]>;
  count(filter: Omit<ListMembersFilter, "limit" | "offset">): Promise<number>;
  create(data: CreateMemberData): Promise<MemberSnapshot>;
  update(
    memberId: string,
    organizationId: string,
    data: UpdateMemberData
  ): Promise<MemberSnapshot | null>;
  deactivate(memberId: string, organizationId: string): Promise<boolean>;
}
