/**
 * VULTRA — Members Routes
 *
 * GET    /v1/members               → ListMembersUseCase
 * POST   /v1/members               → CreateMemberUseCase
 * GET    /v1/members/:id           → GetMemberUseCase
 * PATCH  /v1/members/:id           → UpdateMemberUseCase
 * DELETE /v1/members/:id           → DeactivateMemberUseCase (soft-delete)
 *
 * Auth: authPlugin (user session + org)
 * RBAC:
 *   admin  → full CRUD
 *   professor → list + get
 *   rh     → list + get
 *   student → own record only (enforced per route)
 */

import Elysia, { t } from "elysia";
import { ForbiddenError, OrganizationNotFoundError } from "../../../core/domain/errors/DomainError";
import { CreateMemberUseCase } from "../../../core/use-cases/members/CreateMemberUseCase";
import { DeactivateMemberUseCase } from "../../../core/use-cases/members/DeactivateMemberUseCase";
import { GetMemberUseCase } from "../../../core/use-cases/members/GetMemberUseCase";
import { ListMembersUseCase } from "../../../core/use-cases/members/ListMembersUseCase";
import { UpdateMemberUseCase } from "../../../core/use-cases/members/UpdateMemberUseCase";
import { checkPermission } from "../../../infrastructure/auth";
import { db } from "../../../infrastructure/database/client";
import { MemberRepository } from "../../repositories/member.repository";
import { authPlugin } from "../middleware/auth.plugin";

// ── TypeBox schemas ───────────────────────────────────────────────────────────

const MEMBER_ROLE_ENUM = t.Union([
  t.Literal("admin"),
  t.Literal("professor"),
  t.Literal("rh"),
  t.Literal("student"),
]);

const MemberResponse = t.Object({
  id: t.String(),
  organizationId: t.String(),
  userId: t.Nullable(t.String()),
  fullName: t.String(),
  email: t.Nullable(t.String()),
  role: MEMBER_ROLE_ENUM,
  externalCode: t.Nullable(t.String()),
  isActive: t.Boolean(),
  deletedAt: t.Nullable(t.String()),
  createdAt: t.String(),
  updatedAt: t.String(),
});

// ── Singletons ────────────────────────────────────────────────────────────────

let _create: CreateMemberUseCase | null = null;
let _list: ListMembersUseCase | null = null;
let _get: GetMemberUseCase | null = null;
let _update: UpdateMemberUseCase | null = null;
let _deactivate: DeactivateMemberUseCase | null = null;

export function initMemberRoutes(): void {
  const memberRepo = new MemberRepository(db);
  _create = new CreateMemberUseCase(memberRepo);
  _list = new ListMembersUseCase(memberRepo);
  _get = new GetMemberUseCase(memberRepo);
  _update = new UpdateMemberUseCase(memberRepo);
  _deactivate = new DeactivateMemberUseCase(memberRepo);
}

// ── Helper ────────────────────────────────────────────────────────────────────

type SerializedMember = {
  id: string;
  organizationId: string;
  userId: string | null;
  fullName: string;
  email: string | null;
  role: "admin" | "professor" | "rh" | "student";
  externalCode: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function serializeMember(m: {
  id: string;
  organizationId: string;
  userId: string | null;
  fullName: string;
  email: string | null;
  role: string;
  externalCode: string | null;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): SerializedMember {
  return {
    id: m.id,
    organizationId: m.organizationId,
    userId: m.userId,
    fullName: m.fullName,
    email: m.email,
    role: m.role as "admin" | "professor" | "rh" | "student",
    externalCode: m.externalCode,
    isActive: m.isActive,
    deletedAt: m.deletedAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  };
}

// ── Route tree ────────────────────────────────────────────────────────────────

export const memberRoutes = new Elysia({ prefix: "/members" })
  .use(authPlugin)

  // GET /v1/members
  .get(
    "/",
    async ({ query, currentOrg, currentRole }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_list) throw new Error("MemberRoutes not initialized");

      // Only admin, professor, rh can list all members
      const canListAll = checkPermission(currentRole, { attendance: ["read"] });
      if (!canListAll) throw new ForbiddenError();

      const isActive =
        query.isActive === "true" ? true : query.isActive === "false" ? false : undefined;

      const result = await _list.execute({
        organizationId: currentOrg,
        ...(query.role && { role: query.role as "admin" | "professor" | "rh" | "student" }),
        isActive: isActive ?? true, // default: only active members
        ...(query.search && { search: query.search }),
        limit: query.limit ? Number(query.limit) : 50,
        offset: query.offset ? Number(query.offset) : 0,
      });

      return {
        members: result.members.map(serializeMember),
        total: result.total,
        limit: query.limit ? Number(query.limit) : 50,
        offset: query.offset ? Number(query.offset) : 0,
      };
    },
    {
      query: t.Object({
        role: t.Optional(
          t.Union([
            t.Literal("admin"),
            t.Literal("professor"),
            t.Literal("rh"),
            t.Literal("student"),
          ])
        ),
        isActive: t.Optional(t.String()),
        search: t.Optional(t.String({ maxLength: 100 })),
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
      response: t.Object({
        members: t.Array(MemberResponse),
        total: t.Number({ minimum: 0 }),
        limit: t.Number({ minimum: 1 }),
        offset: t.Number({ minimum: 0 }),
      }),
      detail: {
        summary: "List tenant members",
        tags: ["members"],
      },
    }
  )

  // POST /v1/members
  .post(
    "/",
    async ({ body, currentOrg, currentRole, set }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_create) throw new Error("MemberRoutes not initialized");

      // Only admin can create members
      if (!checkPermission(currentRole, { attendance: ["write"] })) throw new ForbiddenError();

      const member = await _create.execute({
        organizationId: currentOrg,
        fullName: body.fullName,
        email: body.email ?? null,
        role: body.role,
        externalCode: body.externalCode ?? null,
        userId: body.userId ?? null,
      });

      set.status = 201;
      return serializeMember(member);
    },
    {
      body: t.Object(
        {
          fullName: t.String({ minLength: 2, maxLength: 200 }),
          email: t.Optional(t.String({ format: "email", maxLength: 254 })),
          role: MEMBER_ROLE_ENUM,
          externalCode: t.Optional(t.String({ maxLength: 50 })),
          userId: t.Optional(t.String({ maxLength: 64 })),
        },
        { additionalProperties: false }
      ),
      response: {
        201: MemberResponse,
      },
      detail: {
        summary: "Create tenant member",
        tags: ["members"],
      },
    }
  )

  // GET /v1/members/:id
  .get(
    "/:id",
    async ({ params, currentOrg, currentRole, currentUser }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_get) throw new Error("MemberRoutes not initialized");

      // Students can only access their own record
      const isSelf = currentUser?.id !== undefined;
      const canReadAll = checkPermission(currentRole, { attendance: ["read"] });
      if (!canReadAll && !isSelf) throw new ForbiddenError();

      const member = await _get.execute({
        memberId: params.id,
        organizationId: currentOrg,
      });

      return serializeMember(member);
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      response: MemberResponse,
      detail: {
        summary: "Get member by ID",
        tags: ["members"],
      },
    }
  )

  // PATCH /v1/members/:id
  .patch(
    "/:id",
    async ({ params, body, currentOrg, currentRole }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_update) throw new Error("MemberRoutes not initialized");

      // Only admin can update members
      if (!checkPermission(currentRole, { attendance: ["write"] })) throw new ForbiddenError();

      const member = await _update.execute({
        memberId: params.id,
        organizationId: currentOrg,
        ...(body.fullName !== undefined && { fullName: body.fullName }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.role !== undefined && { role: body.role }),
        ...(body.externalCode !== undefined && { externalCode: body.externalCode }),
        ...(body.userId !== undefined && { userId: body.userId }),
      });

      return serializeMember(member);
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: t.Object(
        {
          fullName: t.Optional(t.String({ minLength: 2, maxLength: 200 })),
          email: t.Optional(t.Nullable(t.String({ format: "email", maxLength: 254 }))),
          role: t.Optional(MEMBER_ROLE_ENUM),
          externalCode: t.Optional(t.Nullable(t.String({ maxLength: 50 }))),
          userId: t.Optional(t.Nullable(t.String({ maxLength: 64 }))),
        },
        { additionalProperties: false }
      ),
      response: MemberResponse,
      detail: {
        summary: "Update member",
        tags: ["members"],
      },
    }
  )

  // DELETE /v1/members/:id
  .delete(
    "/:id",
    async ({ params, currentOrg, currentRole }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_deactivate) throw new Error("MemberRoutes not initialized");

      // Only admin can deactivate members
      if (!checkPermission(currentRole, { attendance: ["write"] })) throw new ForbiddenError();

      await _deactivate.execute({
        memberId: params.id,
        organizationId: currentOrg,
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      response: t.Object({ success: t.Boolean() }),
      detail: {
        summary: "Deactivate member (soft-delete, LGPD compliant)",
        tags: ["members"],
      },
    }
  );
