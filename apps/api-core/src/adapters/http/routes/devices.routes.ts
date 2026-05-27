/**
 * VULTRA — Devices Routes
 *
 * GET    /v1/devices               → ListDevicesUseCase
 * POST   /v1/devices               → RegisterDeviceUseCase + Better Auth createApiKey
 * PATCH  /v1/devices/:id           → UpdateDeviceUseCase
 * POST   /v1/devices/:id/rotate-key → RotateDeviceKeyUseCase + Better Auth list/delete/create
 * DELETE /v1/devices/:id           → DeactivateDeviceUseCase
 *
 * Auth: authPlugin — devices:manage required for ALL routes.
 *
 * API keys são geridas pelo @better-auth/api-key plugin (tabela auth_apikeys).
 * A plaintext key é retornada ONCE — nunca é armazenada nas tabelas de domínio,
 * nem em audit logs (LGPD).
 * O ESP32 deve enviar a key no header X-API-Key.
 */

import Elysia, { t } from "elysia";
import { ForbiddenError, OrganizationNotFoundError } from "../../../core/domain/errors/DomainError";
import { DeactivateDeviceUseCase } from "../../../core/use-cases/devices/DeactivateDeviceUseCase";
import { ListDevicesUseCase } from "../../../core/use-cases/devices/ListDevicesUseCase";
import { RegisterDeviceUseCase } from "../../../core/use-cases/devices/RegisterDeviceUseCase";
import { RotateDeviceKeyUseCase } from "../../../core/use-cases/devices/RotateDeviceKeyUseCase";
import { UpdateDeviceUseCase } from "../../../core/use-cases/devices/UpdateDeviceUseCase";
import { auth, checkPermission } from "../../../infrastructure/auth";
import { db } from "../../../infrastructure/database/client";
import { AuditLogRepository } from "../../repositories/audit-log.repository";
import { DeviceRepository } from "../../repositories/device.repository";
import { authPlugin } from "../middleware/auth.plugin";

// ── Singletons ────────────────────────────────────────────────────────────────

let _register: RegisterDeviceUseCase | null = null;
let _list: ListDevicesUseCase | null = null;
let _update: UpdateDeviceUseCase | null = null;
let _rotate: RotateDeviceKeyUseCase | null = null;
let _deactivate: DeactivateDeviceUseCase | null = null;

export function initDeviceRoutes(): void {
  const deviceRepo = new DeviceRepository(db);
  const auditLogRepo = new AuditLogRepository(db);
  _register = new RegisterDeviceUseCase(deviceRepo, auditLogRepo);
  _list = new ListDevicesUseCase(deviceRepo);
  _update = new UpdateDeviceUseCase(deviceRepo);
  _rotate = new RotateDeviceKeyUseCase(deviceRepo, auditLogRepo);
  _deactivate = new DeactivateDeviceUseCase(deviceRepo, auditLogRepo);
}

// ── TypeBox schemas ───────────────────────────────────────────────────────────

const DeviceResponse = t.Object({
  id: t.String(),
  organizationId: t.String(),
  label: t.String(),
  location: t.Nullable(t.String()),
  firmwareVersion: t.Nullable(t.String()),
  lastSeenAt: t.Nullable(t.String()),
  isActive: t.Boolean(),
  createdAt: t.String(),
  updatedAt: t.String(),
});

// ── Helper ────────────────────────────────────────────────────────────────────

function serializeDevice(d: {
  id: string;
  organizationId: string;
  label: string;
  location: string | null;
  firmwareVersion: string | null;
  lastSeenAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: d.id,
    organizationId: d.organizationId,
    label: d.label,
    location: d.location,
    firmwareVersion: d.firmwareVersion,
    lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    isActive: d.isActive,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

function requireDevicesManage(currentRole: string | null | undefined) {
  if (!checkPermission(currentRole, { devices: ["manage"] })) {
    throw new ForbiddenError();
  }
}

// ── Route tree ────────────────────────────────────────────────────────────────

export const deviceRoutes = new Elysia({ prefix: "/devices" })
  .use(authPlugin)

  // GET /v1/devices — requires devices:manage (admin only)
  .get(
    "/",
    async ({ query, currentOrg, currentRole }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_list) throw new Error("DeviceRoutes not initialized");

      requireDevicesManage(currentRole);

      const isActive =
        query.isActive === "false" ? false : query.isActive === "all" ? undefined : true;

      const deviceList = await _list.execute({
        organizationId: currentOrg,
        ...(isActive !== undefined && { isActive }),
      });

      return deviceList.map(serializeDevice);
    },
    {
      query: t.Object({
        /** "true" (default) | "false" | "all" */
        isActive: t.Optional(t.String()),
      }),
      response: t.Array(DeviceResponse),
      detail: {
        summary: "List tenant devices (admin only)",
        tags: ["devices"],
      },
    }
  )

  // POST /v1/devices
  .post(
    "/",
    async ({ body, currentOrg, currentRole, currentUser, set, headers }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_register) throw new Error("DeviceRoutes not initialized");

      requireDevicesManage(currentRole);

      // 1. Criar device record (sem credencial na tabela de domínio)
      const device = await _register.execute({
        organizationId: currentOrg,
        label: body.label,
        location: body.location ?? null,
        actorId: currentUser.id,
        actorType: "user",
      });

      // 2. Gerar API key via Better Auth (armazenada em auth_apikeys, sem RLS)
      //    API key plaintext nunca é persistida nem logada (LGPD)
      const keyResult = await auth.api.createApiKey({
        body: {
          name: `device-${device.id}`,
          organizationId: currentOrg,
          metadata: { deviceId: device.id },
        },
        headers: new Headers(headers as Record<string, string>),
      });

      set.status = 201;
      return {
        device: serializeDevice(device),
        apiKey: keyResult.key,
      };
    },
    {
      body: t.Object(
        {
          label: t.String({ minLength: 1, maxLength: 100 }),
          location: t.Optional(t.String({ maxLength: 200 })),
        },
        { additionalProperties: false }
      ),
      response: {
        201: t.Object({
          device: DeviceResponse,
          apiKey: t.String({
            description:
              "Plaintext API key — retornada UMA VEZ. Provisionar no firmware ESP32 como header X-API-Key.",
          }),
        }),
      },
      detail: {
        summary: "Register a new ESP32-CAM device",
        description:
          "Creates a device and returns its API key ONCE. " +
          "The key is managed by Better Auth and never stored in domain tables or audit logs. " +
          "If lost, use POST /v1/devices/:id/rotate-key.",
        tags: ["devices"],
      },
    }
  )

  // PATCH /v1/devices/:id
  .patch(
    "/:id",
    async ({ params, body, currentOrg, currentRole }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_update) throw new Error("DeviceRoutes not initialized");

      requireDevicesManage(currentRole);

      const device = await _update.execute({
        deviceId: params.id,
        organizationId: currentOrg,
        ...(body.label !== undefined && { label: body.label }),
        ...(body.location !== undefined && { location: body.location }),
        ...(body.firmwareVersion !== undefined && { firmwareVersion: body.firmwareVersion }),
      });

      return serializeDevice(device);
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      body: t.Object(
        {
          label: t.Optional(t.String({ minLength: 1, maxLength: 100 })),
          location: t.Optional(t.Nullable(t.String({ maxLength: 200 }))),
          firmwareVersion: t.Optional(t.Nullable(t.String({ maxLength: 50 }))),
        },
        { additionalProperties: false }
      ),
      response: DeviceResponse,
      detail: {
        summary: "Update device metadata",
        tags: ["devices"],
      },
    }
  )

  // POST /v1/devices/:id/rotate-key
  .post(
    "/:id/rotate-key",
    async ({ params, currentOrg, currentRole, currentUser, headers }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_rotate) throw new Error("DeviceRoutes not initialized");

      requireDevicesManage(currentRole);

      // 1. Validar que o device existe e está ativo + gerar audit log
      await _rotate.execute({
        deviceId: params.id,
        organizationId: currentOrg,
        actorId: currentUser.id,
        actorType: "user",
      });

      const reqHeaders = new Headers(headers as Record<string, string>);

      // 2. Buscar as keys existentes para este device (por organizationId + metadata.deviceId)
      const listResult = await auth.api.listApiKeys({
        query: { organizationId: currentOrg },
        headers: reqHeaders,
      });

      // 3. Revogar a(s) key(s) existente(s) deste device
      type ApiKeyEntry = { id: string; metadata?: unknown };
      const existingKeys = (listResult.apiKeys as ApiKeyEntry[]).filter(
        (k) => (k.metadata as { deviceId?: string } | null)?.deviceId === params.id
      );

      await Promise.all(
        existingKeys.map((k) =>
          auth.api.deleteApiKey({
            body: { keyId: k.id },
            headers: reqHeaders,
          })
        )
      );

      // 4. Criar nova key — plaintext retornado UMA VEZ, nunca persistido nem logado
      const keyResult = await auth.api.createApiKey({
        body: {
          name: `device-${params.id}`,
          organizationId: currentOrg,
          metadata: { deviceId: params.id },
        },
        headers: reqHeaders,
      });

      return { apiKey: keyResult.key };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      response: t.Object({
        apiKey: t.String({
          description:
            "Nova API key — retornada UMA VEZ. A key anterior foi revogada. Atualizar firmware imediatamente.",
        }),
      }),
      detail: {
        summary: "Rotate device API key",
        description:
          "Revokes the current key and generates a new one via Better Auth. " +
          "The new key is returned ONCE — update device firmware immediately. " +
          "Key plaintext is never stored in domain tables or audit logs.",
        tags: ["devices"],
      },
    }
  )

  // DELETE /v1/devices/:id
  .delete(
    "/:id",
    async ({ params, currentOrg, currentRole, currentUser }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_deactivate) throw new Error("DeviceRoutes not initialized");

      requireDevicesManage(currentRole);

      await _deactivate.execute({
        deviceId: params.id,
        organizationId: currentOrg,
        actorId: currentUser.id,
        actorType: "user",
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      response: t.Object({ success: t.Boolean() }),
      detail: {
        summary: "Deactivate device",
        description:
          "Sets is_active = FALSE. The device API key will be rejected by the auth middleware " +
          "immediately after deactivation (device lookup returns null).",
        tags: ["devices"],
      },
    }
  );
