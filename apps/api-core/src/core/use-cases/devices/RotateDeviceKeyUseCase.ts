/**
 * VULTRA — RotateDeviceKeyUseCase
 *
 * POST /v1/devices/:id/rotate-key
 * Validates that the device exists and is active before key rotation.
 *
 * Actual key revocation and generation are handled at the route layer
 * via Better Auth (@better-auth/api-key plugin).
 *
 * LGPD: new API key plaintext is never included in audit payloads.
 */

import type { AuditActorType, IAuditLogRepository } from "../../ports/IAuditLogRepository";
import type { DeviceSnapshot, IDeviceRepository } from "../../ports/IDeviceRepository";
import { DeviceNotFoundError } from "./errors";

export interface RotateDeviceKeyInput {
  deviceId: string;
  organizationId: string;
  actorId: string;
  actorType: AuditActorType;
}

export class RotateDeviceKeyUseCase {
  constructor(
    private readonly deviceRepo: IDeviceRepository,
    private readonly auditLogRepo: IAuditLogRepository
  ) {}

  async execute(input: RotateDeviceKeyInput): Promise<DeviceSnapshot> {
    const device = await this.deviceRepo.findById(input.deviceId, input.organizationId);

    if (!device || !device.isActive) {
      throw new DeviceNotFoundError();
    }

    // Audit DEVICE_KEY_ROTATED — new key plaintext intentionally excluded
    await this.auditLogRepo.insert({
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: "DEVICE_KEY_ROTATED",
      resourceType: "devices",
      resourceId: device.id,
      payload: {
        label: device.label,
      },
    });

    return device;
  }
}
