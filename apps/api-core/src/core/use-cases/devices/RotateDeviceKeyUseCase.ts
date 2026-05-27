/**
 * VULTRA — RotateDeviceKeyUseCase
 *
 * POST /v1/devices/:id/rotate-key
 * Validates that the device exists and is active before key rotation.
 *
 * Actual key revocation and generation are handled at the route layer
 * via Better Auth (@better-auth/api-key plugin).
 */

import type { DeviceSnapshot, IDeviceRepository } from "../../ports/IDeviceRepository";
import { DeviceNotFoundError } from "./errors";

export interface RotateDeviceKeyInput {
  deviceId: string;
  organizationId: string;
}

export class RotateDeviceKeyUseCase {
  constructor(private readonly deviceRepo: IDeviceRepository) {}

  async execute(input: RotateDeviceKeyInput): Promise<DeviceSnapshot> {
    const device = await this.deviceRepo.findById(input.deviceId, input.organizationId);

    if (!device || !device.isActive) {
      throw new DeviceNotFoundError();
    }

    return device;
  }
}
