/**
 * VULTRA — DeactivateDeviceUseCase
 *
 * DELETE /v1/devices/:id
 * Deactivates an ESP32-CAM device.
 * After deactivation, the device's X-Device-Token will be rejected by
 * the device-auth middleware (is_active = FALSE filter).
 */

import type { IDeviceRepository } from "../../ports/IDeviceRepository";
import { DeviceNotFoundError } from "./RotateDeviceKeyUseCase";

export interface DeactivateDeviceInput {
  deviceId: string;
  organizationId: string;
}

export class DeactivateDeviceUseCase {
  constructor(private readonly deviceRepo: IDeviceRepository) {}

  async execute(input: DeactivateDeviceInput): Promise<void> {
    const deactivated = await this.deviceRepo.deactivate(input.deviceId, input.organizationId);

    if (!deactivated) throw new DeviceNotFoundError();
  }
}
