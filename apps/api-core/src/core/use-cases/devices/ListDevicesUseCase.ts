/**
 * VULTRA — ListDevicesUseCase
 *
 * GET /v1/devices
 * Lists ESP32-CAM devices for a tenant.
 * API key hashes are NEVER returned.
 */

import type { DeviceSnapshot, IDeviceRepository } from "../../ports/IDeviceRepository";

export interface ListDevicesInput {
  organizationId: string;
  isActive?: boolean;
}

export class ListDevicesUseCase {
  constructor(private readonly deviceRepo: IDeviceRepository) {}

  async execute(input: ListDevicesInput): Promise<DeviceSnapshot[]> {
    return this.deviceRepo.list({
      organizationId: input.organizationId,
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    });
  }
}
