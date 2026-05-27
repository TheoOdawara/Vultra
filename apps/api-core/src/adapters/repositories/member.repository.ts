/**
 * VULTRA — Member Repository
 *
 * Handles database operations for the `members` table.
 * All queries run inside withTenantContext to activate RLS for the tenant.
 * Application-level organizationId filters are kept as defense-in-depth.
 * Soft-delete: deactivation sets is_active = FALSE and records deleted_at.
 */

import { and, count, eq, ilike, isNull, or, sql } from "drizzle-orm";
import type {
  CreateMemberData,
  IMemberRepository,
  ListMembersFilter,
  MemberSnapshot,
  UpdateMemberData,
} from "../../core/ports/IMemberRepository";
import { withTenantContext } from "../../infrastructure/database/client";
import type { Db, Tx } from "../../infrastructure/database/client";
import { members } from "../../infrastructure/database/schema";

export class MemberRepository implements IMemberRepository {
  constructor(private readonly db: Db) {}

  async findById(memberId: string, organizationId: string): Promise<MemberSnapshot | null> {
    return withTenantContext(this.db, organizationId, async (tx: Tx) => {
      const [row] = await tx
        .select()
        .from(members)
        .where(and(eq(members.id, memberId), eq(members.organizationId, organizationId)))
        .limit(1);

      return row ?? null;
    });
  }

  async findByUserId(userId: string, organizationId: string): Promise<MemberSnapshot | null> {
    return withTenantContext(this.db, organizationId, async (tx: Tx) => {
      const [row] = await tx
        .select()
        .from(members)
        .where(
          and(
            eq(members.userId, userId),
            eq(members.organizationId, organizationId),
            eq(members.isActive, true)
          )
        )
        .limit(1);

      return row ?? null;
    });
  }

  async findByExternalCode(
    externalCode: string,
    organizationId: string
  ): Promise<MemberSnapshot | null> {
    return withTenantContext(this.db, organizationId, async (tx: Tx) => {
      const [row] = await tx
        .select()
        .from(members)
        .where(
          and(
            eq(members.externalCode, externalCode),
            eq(members.organizationId, organizationId),
            eq(members.isActive, true)
          )
        )
        .limit(1);

      return row ?? null;
    });
  }

  async list(filter: ListMembersFilter): Promise<MemberSnapshot[]> {
    return withTenantContext(this.db, filter.organizationId, async (tx: Tx) => {
      const conditions = [eq(members.organizationId, filter.organizationId)];

      if (filter.role !== undefined) {
        conditions.push(eq(members.role, filter.role));
      }

      if (filter.isActive !== undefined) {
        conditions.push(eq(members.isActive, filter.isActive));
      }

      if (filter.search) {
        const pattern = `%${filter.search}%`;
        const searchCond = or(
          ilike(members.fullName, pattern),
          ilike(sql`COALESCE(${members.email}, '')`, pattern)
        );
        if (searchCond) conditions.push(searchCond);
      }

      let query = tx
        .select()
        .from(members)
        .where(and(...conditions))
        .orderBy(members.fullName)
        .$dynamic();

      if (filter.limit !== undefined) {
        query = query.limit(filter.limit);
      }

      if (filter.offset !== undefined) {
        query = query.offset(filter.offset);
      }

      return query;
    });
  }

  async count(filter: Omit<ListMembersFilter, "limit" | "offset">): Promise<number> {
    return withTenantContext(this.db, filter.organizationId, async (tx: Tx) => {
      const conditions = [eq(members.organizationId, filter.organizationId)];

      if (filter.role !== undefined) {
        conditions.push(eq(members.role, filter.role));
      }

      if (filter.isActive !== undefined) {
        conditions.push(eq(members.isActive, filter.isActive));
      }

      if (filter.search) {
        const pattern = `%${filter.search}%`;
        const searchCond = or(
          ilike(members.fullName, pattern),
          ilike(sql`COALESCE(${members.email}, '')`, pattern)
        );
        if (searchCond) conditions.push(searchCond);
      }

      const [result] = await tx
        .select({ total: count() })
        .from(members)
        .where(and(...conditions));

      return result?.total ?? 0;
    });
  }

  async create(data: CreateMemberData): Promise<MemberSnapshot> {
    return withTenantContext(this.db, data.organizationId, async (tx: Tx) => {
      const [row] = await tx
        .insert(members)
        .values({
          organizationId: data.organizationId,
          userId: data.userId ?? null,
          fullName: data.fullName,
          email: data.email ?? null,
          role: data.role,
          externalCode: data.externalCode ?? null,
          isActive: true,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to create member");
      }

      return row;
    });
  }

  async update(
    memberId: string,
    organizationId: string,
    data: UpdateMemberData
  ): Promise<MemberSnapshot | null> {
    return withTenantContext(this.db, organizationId, async (tx: Tx) => {
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (data.fullName !== undefined) updates.fullName = data.fullName;
      if (data.email !== undefined) updates.email = data.email;
      if (data.role !== undefined) updates.role = data.role;
      if (data.externalCode !== undefined) updates.externalCode = data.externalCode;
      if (data.userId !== undefined) updates.userId = data.userId;

      const [row] = await tx
        .update(members)
        .set(updates)
        .where(
          and(
            eq(members.id, memberId),
            eq(members.organizationId, organizationId),
            eq(members.isActive, true)
          )
        )
        .returning();

      return row ?? null;
    });
  }

  async deactivate(memberId: string, organizationId: string): Promise<boolean> {
    return withTenantContext(this.db, organizationId, async (tx: Tx) => {
      const [row] = await tx
        .update(members)
        .set({
          isActive: false,
          deletedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(members.id, memberId),
            eq(members.organizationId, organizationId),
            eq(members.isActive, true),
            isNull(members.deletedAt)
          )
        )
        .returning({ id: members.id });

      return !!row;
    });
  }
}
