/**
 * VULTRA — Devices Use Cases Tests
 */

import { describe, expect, it } from "bun:test";
import type {
  CreateDeviceData,
  DeviceSnapshot,
  IDeviceRepository,
  ListDevicesFilter,
  UpdateDeviceData,
} from "../../core/ports/IDeviceRepository.ts";
import { DeactivateDeviceUseCase } from "../../core/use-cases/devices/DeactivateDeviceUseCase.ts";
import { ListDevicesUseCase } from "../../core/use-cases/devices/ListDevicesUseCase.ts";
import { RegisterDeviceUseCase } from "../../core/use-cases/devices/RegisterDeviceUseCase.ts";
import {
  DeviceNotFoundError,
  RotateDeviceKeyUseCase,
} from "../../core/use-cases/devices/RotateDeviceKeyUseCase.ts";
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

function createDeviceRepoStub() {
  const store: Map<string, DeviceSnapshot> = new Map();
  const hashStore: Map<string, string> = new Map(); // deviceId → apiKeyHash

  const calls = {
    findById: [] as Array<{ deviceId: string; organizationId: string }>,
    list: [] as ListDevicesFilter[],
    create: [] as CreateDeviceData[],
    update: [] as Array<{ deviceId: string; organizationId: string; data: UpdateDeviceData }>,
    rotateApiKey: [] as Array<{ deviceId: string; organizationId: string; newApiKeyHash: string }>,
    deactivate: [] as Array<{ deviceId: string; organizationId: string }>,
  };

  const stub: IDeviceRepository & {
    calls: typeof calls;
    store: typeof store;
    hashStore: typeof hashStore;
  } = {
    calls,
    store,
    hashStore,

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
        id: `device-new-${Date.now()}`,
        organizationId: data.organizationId,
        label: data.label,
        location: data.location ?? null,
      });
      store.set(`${data.organizationId}:${device.id}`, device);
      hashStore.set(device.id, data.apiKeyHash);
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

    async rotateApiKey(deviceId, organizationId, newApiKeyHash) {
      calls.rotateApiKey.push({ deviceId, organizationId, newApiKeyHash });
      const key = `${organizationId}:${deviceId}`;
      const existing = store.get(key);
      // biome-ignore lint/complexity/useOptionalChain: test stub — explicit null check is clearer
      if (!existing || !existing.isActive) return false;
      hashStore.set(deviceId, newApiKeyHash);
      return true;
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

// ── RegisterDeviceUseCase ─────────────────────────────────────────────────────

describe("RegisterDeviceUseCase", () => {
  it("deve registrar dispositivo e retornar chave em texto plano", async () => {
    const repo = createDeviceRepoStub();
    const useCase = new RegisterDeviceUseCase(repo);

    const result = await useCase.execute({
      organizationId: "org-1",
      label: "CAM-ENTRADA",
      location: "Portaria",
    });

    expect(result.device.label).toBe("CAM-ENTRADA");
    expect(result.device.location).toBe("Portaria");
    expect(result.apiKey).toBeTruthy();
    expect(typeof result.apiKey).toBe("string");
    expect(result.apiKey.length).toBe(64); // 32 bytes → 64 hex chars
  });

  it("deve armazenar hash diferente do texto plano", async () => {
    const repo = createDeviceRepoStub();
    const useCase = new RegisterDeviceUseCase(repo);

    const result = await useCase.execute({
      organizationId: "org-1",
      label: "CAM-TEST",
    });

    const storedHash = repo.hashStore.get(result.device.id);
    expect(storedHash).not.toBe(result.apiKey);
    expect(storedHash).toBeTruthy();
  });

  it("deve gerar chaves únicas a cada registro", async () => {
    const repo = createDeviceRepoStub();
    const useCase = new RegisterDeviceUseCase(repo);

    const [r1, r2] = await Promise.all([
      useCase.execute({ organizationId: "org-1", label: "CAM-A" }),
      useCase.execute({ organizationId: "org-1", label: "CAM-B" }),
    ]);

    expect(r1.apiKey).not.toBe(r2.apiKey);
  });

  it("deve associar o dispositivo ao tenant correto", async () => {
    const repo = createDeviceRepoStub();
    const useCase = new RegisterDeviceUseCase(repo);

    const result = await useCase.execute({ organizationId: "org-tenant-x", label: "CAM-X" });

    expect(result.device.organizationId).toBe("org-tenant-x");
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
  it("deve rotacionar chave com sucesso e retornar nova chave em texto plano", async () => {
    const repo = createDeviceRepoStub();
    repo.store.set("org-1:device-1", makeDevice({ id: "device-1", organizationId: "org-1" }));
    repo.hashStore.set("device-1", "old-hash");

    const useCase = new RotateDeviceKeyUseCase(repo);

    const result = await useCase.execute({ deviceId: "device-1", organizationId: "org-1" });

    expect(result.apiKey).toBeTruthy();
    expect(result.apiKey.length).toBe(64);
    // Old hash should be replaced
    expect(repo.hashStore.get("device-1")).not.toBe("old-hash");
  });

  it("deve lançar DeviceNotFoundError para dispositivo inativo ou inexistente", async () => {
    const repo = createDeviceRepoStub();
    const useCase = new RotateDeviceKeyUseCase(repo);

    await expect(
      useCase.execute({ deviceId: "ghost-device", organizationId: "org-1" })
    ).rejects.toBeInstanceOf(DeviceNotFoundError);
  });

  it("deve gerar nova chave diferente da anterior", async () => {
    const repo = createDeviceRepoStub();
    repo.store.set("org-1:d-1", makeDevice({ id: "d-1", organizationId: "org-1" }));
    repo.hashStore.set("d-1", "initial-hash");

    const useCase = new RotateDeviceKeyUseCase(repo);

    const r1 = await useCase.execute({ deviceId: "d-1", organizationId: "org-1" });
    const r2 = await useCase.execute({ deviceId: "d-1", organizationId: "org-1" });

    expect(r1.apiKey).not.toBe(r2.apiKey);
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

    const useCase = new DeactivateDeviceUseCase(repo);

    await expect(
      useCase.execute({ deviceId: "d-1", organizationId: "org-1" })
    ).resolves.toBeUndefined();

    expect(repo.store.get("org-1:d-1")?.isActive).toBe(false);
  });

  it("deve lançar DeviceNotFoundError para dispositivo já inativo", async () => {
    const repo = createDeviceRepoStub();
    repo.store.set(
      "org-1:d-inactive",
      makeDevice({ id: "d-inactive", organizationId: "org-1", isActive: false })
    );

    const useCase = new DeactivateDeviceUseCase(repo);

    await expect(
      useCase.execute({ deviceId: "d-inactive", organizationId: "org-1" })
    ).rejects.toBeInstanceOf(DeviceNotFoundError);
  });
});
