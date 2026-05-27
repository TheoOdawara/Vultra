/**
 * VULTRA — Members Use Cases Tests
 */

import { describe, expect, it } from "bun:test";
import type {
  CreateMemberData,
  IMemberRepository,
  ListMembersFilter,
  MemberSnapshot,
  UpdateMemberData,
} from "../../core/ports/IMemberRepository.ts";
import type {
  IAuditLogRepository,
  InsertAuditLogParams,
} from "../../core/ports/IAuditLogRepository.ts";
import {
  CreateMemberUseCase,
  MemberExternalCodeConflictError,
} from "../../core/use-cases/members/CreateMemberUseCase.ts";
import { DeactivateMemberUseCase } from "../../core/use-cases/members/DeactivateMemberUseCase.ts";
import { MemberNotFoundError } from "../../core/use-cases/members/errors.ts";
import { GetMemberUseCase } from "../../core/use-cases/members/GetMemberUseCase.ts";
import { ListMembersUseCase } from "../../core/use-cases/members/ListMembersUseCase.ts";
import { UpdateMemberUseCase } from "../../core/use-cases/members/UpdateMemberUseCase.ts";

// ── Stub ──────────────────────────────────────────────────────────────────────

function makeMember(overrides: Partial<MemberSnapshot> = {}): MemberSnapshot {
  return {
    id: "member-1",
    organizationId: "org-1",
    userId: null,
    fullName: "Ana Silva",
    email: "ana@escola.br",
    role: "student",
    externalCode: "MAT-001",
    isActive: true,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function createMemberRepoStub() {
  const store: Map<string, MemberSnapshot> = new Map();

  const calls = {
    findById: [] as Array<{ memberId: string; organizationId: string }>,
    findByUserId: [] as Array<{ userId: string; organizationId: string }>,
    findByExternalCode: [] as Array<{ externalCode: string; organizationId: string }>,
    list: [] as ListMembersFilter[],
    count: [] as Array<Omit<ListMembersFilter, "limit" | "offset">>,
    create: [] as CreateMemberData[],
    update: [] as Array<{ memberId: string; organizationId: string; data: UpdateMemberData }>,
    deactivate: [] as Array<{ memberId: string; organizationId: string }>,
  };

  const stub: IMemberRepository & { calls: typeof calls; store: typeof store } = {
    calls,
    store,

    async findById(memberId, organizationId) {
      calls.findById.push({ memberId, organizationId });
      return store.get(`${organizationId}:${memberId}`) ?? null;
    },

    async findByUserId(userId, organizationId) {
      calls.findByUserId.push({ userId, organizationId });
      return (
        [...store.values()].find(
          (member) => member.organizationId === organizationId && member.userId === userId
        ) ?? null
      );
    },

    async findByExternalCode(externalCode, organizationId) {
      calls.findByExternalCode.push({ externalCode, organizationId });
      for (const m of store.values()) {
        if (m.organizationId === organizationId && m.externalCode === externalCode && m.isActive) {
          return m;
        }
      }
      return null;
    },

    async list(filter) {
      calls.list.push(filter);
      return [...store.values()].filter((m) => m.organizationId === filter.organizationId);
    },

    async count(filter) {
      calls.count.push(filter);
      return [...store.values()].filter((m) => m.organizationId === filter.organizationId).length;
    },

    async create(data) {
      calls.create.push(data);
      const member = makeMember({
        ...data,
        id: `member-new-${Date.now()}`,
        userId: data.userId ?? null,
        email: data.email ?? null,
        externalCode: data.externalCode ?? null,
      });
      store.set(`${data.organizationId}:${member.id}`, member);
      return member;
    },

    async update(memberId, organizationId, data) {
      calls.update.push({ memberId, organizationId, data });
      const key = `${organizationId}:${memberId}`;
      const existing = store.get(key);
      // biome-ignore lint/complexity/useOptionalChain: test stub — explicit null check is clearer
      if (!existing || !existing.isActive) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      store.set(key, updated);
      return updated;
    },

    async deactivate(memberId, organizationId) {
      calls.deactivate.push({ memberId, organizationId });
      const key = `${organizationId}:${memberId}`;
      const existing = store.get(key);
      // biome-ignore lint/complexity/useOptionalChain: test stub — explicit null check is clearer
      if (!existing || !existing.isActive) return false;
      store.set(key, { ...existing, isActive: false, deletedAt: new Date() });
      return true;
    },
  };

  return stub;
}

function createAuditLogRepoStub() {
  const calls = {
    insert: [] as InsertAuditLogParams[],
  };

  const stub: IAuditLogRepository & { calls: typeof calls } = {
    calls,
    async insert(params) {
      calls.insert.push(params);
    },
  };

  return stub;
}

// ── CreateMemberUseCase ───────────────────────────────────────────────────────

describe("CreateMemberUseCase", () => {
  it("deve criar um membro com sucesso", async () => {
    const repo = createMemberRepoStub();
    const auditLogRepo = createAuditLogRepoStub();
    const useCase = new CreateMemberUseCase(repo, auditLogRepo);

    const result = await useCase.execute({
      organizationId: "org-1",
      fullName: "João Costa",
      role: "student",
      externalCode: "MAT-100",
      actorId: "user-admin",
      actorType: "user",
    });

    expect(result.fullName).toBe("João Costa");
    expect(result.role).toBe("student");
    expect(repo.calls.create).toHaveLength(1);
    expect(repo.calls.create[0]).toMatchObject({ organizationId: "org-1", role: "student" });
    expect(auditLogRepo.calls.insert[0]).toMatchObject({
      action: "MEMBER_CREATED",
      actorId: "user-admin",
      resourceType: "members",
      resourceId: result.id,
      payload: {
        full_name: "João Costa",
        role: "student",
        external_code: "MAT-100",
      },
    });
  });

  it("deve rejeitar externalCode duplicado dentro do tenant", async () => {
    const repo = createMemberRepoStub();
    const existing = makeMember({ externalCode: "MAT-DUP", organizationId: "org-1" });
    repo.store.set("org-1:member-1", existing);

    const auditLogRepo = createAuditLogRepoStub();
    const useCase = new CreateMemberUseCase(repo, auditLogRepo);

    await expect(
      useCase.execute({
        organizationId: "org-1",
        fullName: "Novo Membro",
        role: "student",
        externalCode: "MAT-DUP",
        actorId: "user-admin",
        actorType: "user",
      })
    ).rejects.toBeInstanceOf(MemberExternalCodeConflictError);

    expect(repo.calls.create).toHaveLength(0);
    expect(auditLogRepo.calls.insert).toHaveLength(0);
  });

  it("não deve verificar código de membros de outro tenant", async () => {
    const repo = createMemberRepoStub();
    // code exists in org-b, not org-a
    const member = makeMember({ externalCode: "MAT-CROSS", organizationId: "org-b" });
    repo.store.set("org-b:member-cross", member);

    const auditLogRepo = createAuditLogRepoStub();
    const useCase = new CreateMemberUseCase(repo, auditLogRepo);

    await expect(
      useCase.execute({
        organizationId: "org-a",
        fullName: "Membro Org A",
        role: "student",
        externalCode: "MAT-CROSS",
        actorId: "user-admin",
        actorType: "user",
      })
    ).resolves.toBeTruthy();
  });

  it("deve criar sem externalCode se não fornecido", async () => {
    const repo = createMemberRepoStub();
    const auditLogRepo = createAuditLogRepoStub();
    const useCase = new CreateMemberUseCase(repo, auditLogRepo);

    const result = await useCase.execute({
      organizationId: "org-1",
      fullName: "Prof. Lima",
      role: "professor",
      actorId: "user-admin",
      actorType: "user",
    });

    expect(result.role).toBe("professor");
    expect(repo.calls.findByExternalCode).toHaveLength(0);
  });
});

// ── GetMemberUseCase ──────────────────────────────────────────────────────────

describe("GetMemberUseCase", () => {
  it("deve retornar o membro quando existir", async () => {
    const repo = createMemberRepoStub();
    const member = makeMember({ id: "m-1", organizationId: "org-1" });
    repo.store.set("org-1:m-1", member);

    const useCase = new GetMemberUseCase(repo);

    await expect(useCase.execute({ memberId: "m-1", organizationId: "org-1" })).resolves.toEqual(
      member
    );
  });

  it("deve lançar MemberNotFoundError para ID inexistente", async () => {
    const repo = createMemberRepoStub();
    const useCase = new GetMemberUseCase(repo);

    await expect(
      useCase.execute({ memberId: "not-found", organizationId: "org-1" })
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });

  it("não deve retornar membro de outro tenant", async () => {
    const repo = createMemberRepoStub();
    repo.store.set("org-b:m-other", makeMember({ id: "m-other", organizationId: "org-b" }));

    const useCase = new GetMemberUseCase(repo);

    await expect(
      useCase.execute({ memberId: "m-other", organizationId: "org-a" })
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });
});

// ── ListMembersUseCase ────────────────────────────────────────────────────────

describe("ListMembersUseCase", () => {
  it("deve retornar membros do tenant com total", async () => {
    const repo = createMemberRepoStub();
    repo.store.set("org-1:m-1", makeMember({ id: "m-1", organizationId: "org-1" }));
    repo.store.set(
      "org-1:m-2",
      makeMember({ id: "m-2", organizationId: "org-1", fullName: "Bia" })
    );

    const useCase = new ListMembersUseCase(repo);

    const result = await useCase.execute({ organizationId: "org-1" });

    expect(result.members).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("deve aplicar paginação padrão quando não informada", async () => {
    const repo = createMemberRepoStub();
    const useCase = new ListMembersUseCase(repo);

    await useCase.execute({ organizationId: "org-1" });

    expect(repo.calls.list[0]).toMatchObject({ limit: 50, offset: 0 });
  });

  it("deve repassar filtro de role ao repositório", async () => {
    const repo = createMemberRepoStub();
    const useCase = new ListMembersUseCase(repo);

    await useCase.execute({ organizationId: "org-1", role: "professor" });

    expect(repo.calls.list[0]).toMatchObject({ role: "professor" });
  });
});

// ── UpdateMemberUseCase ───────────────────────────────────────────────────────

describe("UpdateMemberUseCase", () => {
  it("deve atualizar nome e role com sucesso", async () => {
    const repo = createMemberRepoStub();
    repo.store.set("org-1:m-1", makeMember({ id: "m-1", organizationId: "org-1" }));
    const auditLogRepo = createAuditLogRepoStub();

    const useCase = new UpdateMemberUseCase(repo, auditLogRepo);

    const updated = await useCase.execute({
      memberId: "m-1",
      organizationId: "org-1",
      fullName: "Ana Silva Renovada",
      role: "rh",
      actorId: "user-admin",
      actorType: "user",
    });

    expect(updated.fullName).toBe("Ana Silva Renovada");
    expect(updated.role).toBe("rh");
    expect(auditLogRepo.calls.insert[0]).toMatchObject({
      action: "MEMBER_UPDATED",
      actorId: "user-admin",
      resourceType: "members",
      resourceId: "m-1",
      payload: {
        full_name: "Ana Silva Renovada",
        role: "rh",
      },
    });
  });

  it("deve lançar MemberNotFoundError quando membro não existir", async () => {
    const repo = createMemberRepoStub();
    const auditLogRepo = createAuditLogRepoStub();
    const useCase = new UpdateMemberUseCase(repo, auditLogRepo);

    await expect(
      useCase.execute({
        memberId: "no-member",
        organizationId: "org-1",
        fullName: "X",
        actorId: "user-admin",
        actorType: "user",
      })
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });

  it("deve lançar MemberExternalCodeConflictError para código duplicado na atualização", async () => {
    const repo = createMemberRepoStub();
    repo.store.set(
      "org-1:m-1",
      makeMember({ id: "m-1", organizationId: "org-1", externalCode: "A" })
    );
    repo.store.set(
      "org-1:m-2",
      makeMember({ id: "m-2", organizationId: "org-1", externalCode: "B" })
    );

    const auditLogRepo = createAuditLogRepoStub();
    const useCase = new UpdateMemberUseCase(repo, auditLogRepo);

    await expect(
      useCase.execute({
        memberId: "m-1",
        organizationId: "org-1",
        externalCode: "B",
        actorId: "user-admin",
        actorType: "user",
      })
    ).rejects.toBeInstanceOf(MemberExternalCodeConflictError);
  });
});

// ── DeactivateMemberUseCase ───────────────────────────────────────────────────

describe("DeactivateMemberUseCase", () => {
  it("deve desativar membro ativo", async () => {
    const repo = createMemberRepoStub();
    repo.store.set("org-1:m-1", makeMember({ id: "m-1", organizationId: "org-1" }));
    const auditLogRepo = createAuditLogRepoStub();

    const useCase = new DeactivateMemberUseCase(repo, auditLogRepo);

    await expect(
      useCase.execute({
        memberId: "m-1",
        organizationId: "org-1",
        actorId: "user-admin",
        actorType: "user",
      })
    ).resolves.toBeUndefined();

    expect(repo.store.get("org-1:m-1")?.isActive).toBe(false);
    expect(auditLogRepo.calls.insert[0]).toMatchObject({
      action: "MEMBER_DEACTIVATED",
      actorId: "user-admin",
      resourceType: "members",
      resourceId: "m-1",
      payload: { member_id: "m-1" },
    });
  });

  it("deve lançar MemberNotFoundError para membro já inativo ou inexistente", async () => {
    const repo = createMemberRepoStub();
    const auditLogRepo = createAuditLogRepoStub();
    const useCase = new DeactivateMemberUseCase(repo, auditLogRepo);

    await expect(
      useCase.execute({
        memberId: "ghost",
        organizationId: "org-1",
        actorId: "user-admin",
        actorType: "user",
      })
    ).rejects.toBeInstanceOf(MemberNotFoundError);
  });
});
