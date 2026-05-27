/**
 * VULTRA — Devices Routes
 *
 * GET    /v1/devices               → ListDevicesUseCase
 * POST   /v1/devices               → RegisterDeviceUseCase  (returns API key ONCE)
 * PATCH  /v1/devices/:id           → UpdateDeviceUseCase
 * POST   /v1/devices/:id/rotate-key → RotateDeviceKeyUseCase (returns new key ONCE)
 * DELETE /v1/devices/:id           → DeactivateDeviceUseCase
 *
 * Auth: authPlugin — admin role required for all write operations.
 * Security: API key is returned in the response body of POST and rotate-key
 *           ONCE — it is NOT stored in plaintext anywhere.
 */

import Elysia, { t } from "elysia";
import { ForbiddenError, OrganizationNotFoundError } from "../../../core/domain/errors/DomainError";
import { DeactivateDeviceUseCase } from "../../../core/use-cases/devices/DeactivateDeviceUseCase";
import { ListDevicesUseCase } from "../../../core/use-cases/devices/ListDevicesUseCase";
import { RegisterDeviceUseCase } from "../../../core/use-cases/devices/RegisterDeviceUseCase";
import { RotateDeviceKeyUseCase } from "../../../core/use-cases/devices/RotateDeviceKeyUseCase";
import { UpdateDeviceUseCase } from "../../../core/use-cases/devices/UpdateDeviceUseCase";
import { checkPermission } from "../../../infrastructure/auth";
import { db } from "../../../infrastructure/database/client";
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
  _register = new RegisterDeviceUseCase(deviceRepo);
  _list = new ListDevicesUseCase(deviceRepo);
  _update = new UpdateDeviceUseCase(deviceRepo);
  _rotate = new RotateDeviceKeyUseCase(deviceRepo);
  _deactivate = new DeactivateDeviceUseCase(deviceRepo);
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

function requireAdmin(currentRole: string | null | undefined) {
  if (!checkPermission(currentRole, { devices: ["manage"] })) {
    throw new ForbiddenError();
  }
}

// ── Route tree ────────────────────────────────────────────────────────────────

export const deviceRoutes = new Elysia({ prefix: "/devices" })
  .use(authPlugin)

  // GET /v1/devices
  .get(
    "/",
    async ({ query, currentOrg, currentRole }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_list) throw new Error("DeviceRoutes not initialized");

      if (!checkPermission(currentRole, { attendance: ["read"] })) throw new ForbiddenError();

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
        summary: "List tenant devices",
        tags: ["devices"],
      },
    }
  )

  // POST /v1/devices
  .post(
    "/",
    async ({ body, currentOrg, currentRole, set }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_register) throw new Error("DeviceRoutes not initialized");

      requireAdmin(currentRole);

      const result = await _register.execute({
        organizationId: currentOrg,
        label: body.label,
        location: body.location ?? null,
      });

      set.status = 201;
      return {
        device: serializeDevice(result.device),
        apiKey: result.apiKey,
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
              "Plaintext API key — returned ONCE. Store it securely and provision into device firmware.",
          }),
        }),
      },
      detail: {
        summary: "Register a new ESP32-CAM device",
        description:
          "Creates a device and returns its API key ONCE. " +
          "The key is stored as a bcrypt hash — there is no way to retrieve it again. " +
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

      requireAdmin(currentRole);

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
    async ({ params, currentOrg, currentRole }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_rotate) throw new Error("DeviceRoutes not initialized");

      requireAdmin(currentRole);

      const result = await _rotate.execute({
        deviceId: params.id,
        organizationId: currentOrg,
      });

      return { apiKey: result.apiKey };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      response: t.Object({
        apiKey: t.String({
          description:
            "New plaintext API key — returned ONCE. The old key is immediately invalidated.",
        }),
      }),
      detail: {
        summary: "Rotate device API key",
        description:
          "Invalidates the current key and generates a new one. " +
          "The new key is returned ONCE — update device firmware immediately.",
        tags: ["devices"],
      },
    }
  )

  // DELETE /v1/devices/:id
  .delete(
    "/:id",
    async ({ params, currentOrg, currentRole }) => {
      if (!currentOrg) throw new OrganizationNotFoundError();
      if (!_deactivate) throw new Error("DeviceRoutes not initialized");

      requireAdmin(currentRole);

      await _deactivate.execute({
        deviceId: params.id,
        organizationId: currentOrg,
      });

      return { success: true };
    },
    {
      params: t.Object({ id: t.String({ format: "uuid" }) }),
      response: t.Object({ success: t.Boolean() }),
      detail: {
        summary: "Deactivate device",
        description:
          "Sets is_active = FALSE. The device token will be rejected by the auth middleware " +
          "immediately after deactivation.",
        tags: ["devices"],
      },
    }
  );
