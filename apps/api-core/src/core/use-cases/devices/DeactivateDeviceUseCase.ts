/**
 * VULTRA — DeactivateDeviceUseCase
 *
 * DELETE /v1/devices/:id
 * Deactivates an ESP32-CAM device.
 * After deactivation, the device's X-Device-Token will be rejected by
 * the device-auth middleware (is_active = FALSE filter).
 */

import type { AuditActorType, IAuditLogRepository } from "../../ports/IAuditLogRepository";
import type { IDeviceRepository } from "../../ports/IDeviceRepository";
import { DeviceNotFoundError } from "./errors";

export interface DeactivateDeviceInput {
  deviceId: string;
  organizationId: string;
  actorId: string;
  actorType: AuditActorType;
}

export class DeactivateDeviceUseCase {
  constructor(
    private readonly deviceRepo: IDeviceRepository,
    private readonly auditLogRepo: IAuditLogRepository
  ) {}

  async execute(input: DeactivateDeviceInput): Promise<void> {
    const deactivated = await this.deviceRepo.deactivate(input.deviceId, input.organizationId);

    if (!deactivated) throw new DeviceNotFoundError();

    await this.auditLogRepo.insert({
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: "DEVICE_DEACTIVATED",
      resourceType: "devices",
      resourceId: input.deviceId,
      payload: {
        device_id: input.deviceId,
      },
    });
  }
}
