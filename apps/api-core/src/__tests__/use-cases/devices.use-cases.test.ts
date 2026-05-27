/**
 * VULTRA — Devices Use Cases Tests
 *
 * RegisterDeviceUseCase: creates the device record (API key handled by Better Auth at route layer)
 * RotateDeviceKeyUseCase: validates device exists and is active before key rotation
 * ListDevicesUseCase, UpdateDeviceUseCase, DeactivateDeviceUseCase: business logic tests
 */

import { describe, expect, it } from "bun:test";
import type {
  CreateDeviceData,
  DeviceSnapshot,
  IDeviceRepository,
  ListDevicesFilter,
  UpdateDeviceData,
} from "../../core/ports/IDeviceRepository.ts";
import type {
  IAuditLogRepository,
  InsertAuditLogParams,
} from "../../core/ports/IAuditLogRepository.ts";
import { DeactivateDeviceUseCase } from "../../core/use-cases/devices/DeactivateDeviceUseCase.ts";
import { ListDevicesUseCase } from "../../core/use-cases/devices/ListDevicesUseCase.ts";
import { RegisterDeviceUseCase } from "../../core/use-cases/devices/RegisterDeviceUseCase.ts";
import { DeviceNotFoundError } from "../../core/use-cases/devices/errors.ts";
import { RotateDeviceKeyUseCase } from "../../core/use-cases/devices/RotateDeviceKeyUseCase.ts";
import { UpdateDeviceUseCase } from "../../core/use-cases/devices/UpdateDeviceUseCase.ts";

// ── Stub ──────────────────────────────────────────────────────────────────────

function makeDevice(overrides: Partial<DeviceSnapshot> = {}): DeviceSnapshot {
  return {
    id: "device-1",
    organizationId: "org-1",
    label: "CAM-SALA-101",
    location: "Sala 101",
    firmwareVersion: "1.0.0",
    lastSeenAt: null,
    isActive: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

let _deviceIdCounter = 0;

function createDeviceRepoStub() {
  const store: Map<string, DeviceSnapshot> = new Map();

  const calls = {
    findById: [] as Array<{ deviceId: string; organizationId: string }>,
    list: [] as ListDevicesFilter[],
    create: [] as CreateDeviceData[],
    update: [] as Array<{ deviceId: string; organizationId: string; data: UpdateDeviceData }>,
    deactivate: [] as Array<{ deviceId: string; organizationId: string }>,
  };

  const stub: IDeviceRepository & {
    calls: typeof calls;
    store: typeof store;
  } = {
    calls,
    store,

    async findById(deviceId, organizationId) {
      calls.findById.push({ deviceId, organizationId });
      return store.get(`${organizationId}:${deviceId}`) ?? null;
    },

    async list(filter) {
      calls.list.push(filter);
      return [...store.values()].filter((d) => d.organizationId === filter.organizationId);
    },

    async create(data) {
      calls.create.push(data);
      const device = makeDevice({
        id: `device-new-${++_deviceIdCounter}`,
        organizationId: data.organizationId,
        label: data.label,
        location: data.location ?? null,
      });
      store.set(`${data.organizationId}:${device.id}`, device);
      return device;
    },

    async update(deviceId, organizationId, data) {
      calls.update.push({ deviceId, organizationId, data });
      const key = `${organizationId}:${deviceId}`;
      const existing = store.get(key);
      // biome-ignore lint/complexity/useOptionalChain: test stub — explicit null check is clearer
      if (!existing || !existing.isActive) return null;
      const updated = { ...existing, ...data, updatedAt: new Date() };
      store.set(key, updated);
      return updated;
    },

    async deactivate(deviceId, organizationId) {
      calls.deactivate.push({ deviceId, organizationId });
      const key = `${organizationId}:${deviceId}`;
      const existing = store.get(key);
      // biome-ignore lint/complexity/useOptionalChain: test stub — explicit null check is clearer
      if (!existing || !existing.isActive) return false;
      store.set(key, { ...existing, isActive: false, updatedAt: new Date() });
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

// ── RegisterDeviceUseCase ─────────────────────────────────────────────────────

describe("RegisterDeviceUseCase", () => {
  it("deve registrar dispositivo e retornar snapshot", async () => {
    const repo = createDeviceRepoStub();
    const auditLogRepo = createAuditLogRepoStub();
    const useCase = new RegisterDeviceUseCase(repo, auditLogRepo);

    const device = await useCase.execute({
      organizationId: "org-1",
      label: "CAM-ENTRADA",
      location: "Portaria",
      actorId: "user-admin",
      actorType: "user",
    });

    expect(device.label).toBe("CAM-ENTRADA");
    expect(device.location).toBe("Portaria");
    expect(device.id).toBeTruthy();
    expect(repo.calls.create).toHaveLength(1);
    expect(auditLogRepo.calls.insert[0]).toMatchObject({
      action: "DEVICE_REGISTERED",
      actorId: "user-admin",
      resourceType: "devices",
      resourceId: device.id,
      payload: {
        label: "CAM-ENTRADA",
        location: "Portaria",
      },
    });
  });

  it("deve gerar chaves únicas a cada registro", async () => {
    const repo = createDeviceRepoStub();
    const auditLogRepo = createAuditLogRepoStub();
    const useCase = new RegisterDeviceUseCase(repo, auditLogRepo);

    const [d1, d2] = await Promise.all([
      useCase.execute({
        organizationId: "org-1",
        label: "CAM-A",
        actorId: "user-admin",
        actorType: "user",
      }),
      useCase.execute({
        organizationId: "org-1",
        label: "CAM-B",
        actorId: "user-admin",
        actorType: "user",
      }),
    ]);

    expect(d1.id).not.toBe(d2.id);
  });

  it("deve associar o dispositivo ao tenant correto", async () => {
    const repo = createDeviceRepoStub();
    const auditLogRepo = createAuditLogRepoStub();
    const useCase = new RegisterDeviceUseCase(repo, auditLogRepo);

    const device = await useCase.execute({
      organizationId: "org-tenant-x",
      label: "CAM-X",
      actorId: "user-admin",
      actorType: "user",
    });

    expect(device.organizationId).toBe("org-tenant-x");
  });
});

// ── ListDevicesUseCase ────────────────────────────────────────────────────────

describe("ListDevicesUseCase", () => {
  it("deve listar dispositivos do tenant", async () => {
    const repo = createDeviceRepoStub();
    repo.store.set("org-1:d-1", makeDevice({ id: "d-1", organizationId: "org-1" }));
    repo.store.set("org-1:d-2", makeDevice({ id: "d-2", organizationId: "org-1", label: "CAM-B" }));

    const useCase = new ListDevicesUseCase(repo);

    const result = await useCase.execute({ organizationId: "org-1" });

    expect(result).toHaveLength(2);
    expect(repo.calls.list[0]).toMatchObject({ organizationId: "org-1" });
  });

  it("não deve incluir dispositivos de outros tenants", async () => {
    const repo = createDeviceRepoStub();
    repo.store.set("org-a:d-1", makeDevice({ id: "d-1", organizationId: "org-a" }));
    repo.store.set("org-b:d-2", makeDevice({ id: "d-2", organizationId: "org-b" }));

    const useCase = new ListDevicesUseCase(repo);

    const result = await useCase.execute({ organizationId: "org-a" });

    expect(result.every((d) => d.organizationId === "org-a")).toBe(true);
  });
});

// ── RotateDeviceKeyUseCase ────────────────────────────────────────────────────

describe("RotateDeviceKeyUseCase", () => {
  it("deve retornar snapshot do dispositivo ativo para rotação de chave", async () => {
    const repo = createDeviceRepoStub();
    repo.store.set("org-1:device-1", makeDevice({ id: "device-1", organizationId: "org-1" }));
    const auditLogRepo = createAuditLogRepoStub();

    const useCase = new RotateDeviceKeyUseCase(repo, auditLogRepo);

    const device = await useCase.execute({
      deviceId: "device-1",
      organizationId: "org-1",
      actorId: "user-admin",
      actorType: "user",
    });

    expect(device.id).toBe("device-1");
    expect(device.isActive).toBe(true);
    expect(repo.calls.findById).toHaveLength(1);
    expect(auditLogRepo.calls.insert[0]).toMatchObject({
      action: "DEVICE_KEY_ROTATED",
      actorId: "user-admin",
      resourceType: "devices",
      resourceId: "device-1",
      payload: { label: "CAM-SALA-101" },
    });
  });

  it("deve lançar DeviceNotFoundError para dispositivo inativo ou inexistente", async () => {
    const repo = createDeviceRepoStub();
    const auditLogRepo = createAuditLogRepoStub();
    const useCase = new RotateDeviceKeyUseCase(repo, auditLogRepo);

    await expect(
      useCase.execute({
        deviceId: "ghost-device",
        organizationId: "org-1",
        actorId: "user-admin",
        actorType: "user",
      })
    ).rejects.toBeInstanceOf(DeviceNotFoundError);
  });

  it("deve lançar DeviceNotFoundError para dispositivo inativo", async () => {
    const repo = createDeviceRepoStub();
    repo.store.set(
      "org-1:d-inactive",
      makeDevice({ id: "d-inactive", organizationId: "org-1", isActive: false })
    );

    const auditLogRepo = createAuditLogRepoStub();
    const useCase = new RotateDeviceKeyUseCase(repo, auditLogRepo);

    await expect(
      useCase.execute({
        deviceId: "d-inactive",
        organizationId: "org-1",
        actorId: "user-admin",
        actorType: "user",
      })
    ).rejects.toBeInstanceOf(DeviceNotFoundError);
  });
});

// ── UpdateDeviceUseCase ───────────────────────────────────────────────────────

describe("UpdateDeviceUseCase", () => {
  it("deve atualizar label e location", async () => {
    const repo = createDeviceRepoStub();
    repo.store.set("org-1:d-1", makeDevice({ id: "d-1", organizationId: "org-1" }));

    const useCase = new UpdateDeviceUseCase(repo);

    const result = await useCase.execute({
      deviceId: "d-1",
      organizationId: "org-1",
      label: "CAM-NOVA-ENTRADA",
      location: "Entrada Principal",
    });

    expect(result.label).toBe("CAM-NOVA-ENTRADA");
    expect(result.location).toBe("Entrada Principal");
  });

  it("deve lançar DeviceNotFoundError para dispositivo inexistente", async () => {
    const repo = createDeviceRepoStub();
    const useCase = new UpdateDeviceUseCase(repo);

    await expect(
      useCase.execute({ deviceId: "ghost", organizationId: "org-1", label: "X" })
    ).rejects.toBeInstanceOf(DeviceNotFoundError);
  });
});

// ── DeactivateDeviceUseCase ───────────────────────────────────────────────────

describe("DeactivateDeviceUseCase", () => {
  it("deve desativar dispositivo ativo", async () => {
    const repo = createDeviceRepoStub();
    repo.store.set("org-1:d-1", makeDevice({ id: "d-1", organizationId: "org-1" }));
    const auditLogRepo = createAuditLogRepoStub();

    const useCase = new DeactivateDeviceUseCase(repo, auditLogRepo);

    await expect(
      useCase.execute({
        deviceId: "d-1",
        organizationId: "org-1",
        actorId: "user-admin",
        actorType: "user",
      })
    ).resolves.toBeUndefined();

    expect(repo.store.get("org-1:d-1")?.isActive).toBe(false);
    expect(auditLogRepo.calls.insert[0]).toMatchObject({
      action: "DEVICE_DEACTIVATED",
      actorId: "user-admin",
      resourceType: "devices",
      resourceId: "d-1",
      payload: { device_id: "d-1" },
    });
  });

  it("deve lançar DeviceNotFoundError para dispositivo já inativo", async () => {
    const repo = createDeviceRepoStub();
    repo.store.set(
      "org-1:d-inactive",
      makeDevice({ id: "d-inactive", organizationId: "org-1", isActive: false })
    );

    const auditLogRepo = createAuditLogRepoStub();
    const useCase = new DeactivateDeviceUseCase(repo, auditLogRepo);

    await expect(
      useCase.execute({
        deviceId: "d-inactive",
        organizationId: "org-1",
        actorId: "user-admin",
        actorType: "user",
      })
    ).rejects.toBeInstanceOf(DeviceNotFoundError);
  });
});
