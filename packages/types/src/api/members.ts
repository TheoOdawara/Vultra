/**
 * VULTRA — Members API Types
 *
 * Contracts for POST/GET/PATCH/DELETE /v1/members
 */

import type { Member, MemberRole } from "../domain.js";

// ── List Members ───────────────────────────────────────────────────────────────

export interface ListMembersQuery {
  role?: MemberRole;
  /** "true" | "false" — defaults to "true" (active only) */
  isActive?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListMembersResponse {
  members: Member[];
  total: number;
  limit: number;
  offset: number;
}

// ── Create Member ─────────────────────────────────────────────────────────────

export interface CreateMemberBody {
  fullName: string;
  email?: string;
  role: MemberRole;
  externalCode?: string;
  userId?: string;
}

/** HTTP 201 */
export type CreateMemberResponse = Member;

// ── Get Member ────────────────────────────────────────────────────────────────

/** HTTP 200 */
export type GetMemberResponse = Member;

// ── Update Member ──────────────────────────────────────────────────────────────

export interface UpdateMemberBody {
  fullName?: string;
  email?: string | null;
  role?: MemberRole;
  externalCode?: string | null;
  userId?: string | null;
}

/** HTTP 200 */
export type UpdateMemberResponse = Member;

// ── Deactivate Member ─────────────────────────────────────────────────────────

/** HTTP 200 */
export interface DeactivateMemberResponse {
  success: boolean;
}
