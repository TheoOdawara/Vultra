/**
 * VULTRA — UpdateDeviceUseCase
 *
 * PATCH /v1/devices/:id
 * Updates device metadata (label, location, firmware version).
 * Does NOT rotate the API key — use RotateDeviceKeyUseCase for that.
 */

import type { DeviceSnapshot, IDeviceRepository } from "../../ports/IDeviceRepository";
import { DeviceNotFoundError } from "./errors";

export interface UpdateDeviceInput {
  deviceId: string;
  organizationId: string;
  label?: string;
  location?: string | null;
  firmwareVersion?: string | null;
}

export class UpdateDeviceUseCase {
  constructor(private readonly deviceRepo: IDeviceRepository) {}

  async execute(input: UpdateDeviceInput): Promise<DeviceSnapshot> {
    const updated = await this.deviceRepo.update(input.deviceId, input.organizationId, {
      ...(input.label !== undefined && { label: input.label }),
      ...(input.location !== undefined && { location: input.location }),
      ...(input.firmwareVersion !== undefined && { firmwareVersion: input.firmwareVersion }),
    });

    if (!updated) throw new DeviceNotFoundError();

    return updated;
  }
}
