/**
 * VULTRA — RegisterDeviceUseCase
 *
 * POST /v1/devices
 * Registers a new ESP32-CAM device for a tenant.
 *
 * This use case only handles the business record creation.
 * API key generation is handled at the route layer via Better Auth
 * (@better-auth/api-key plugin) so credentials are never stored in
 * the domain tables.
 */

import type { DeviceSnapshot, IDeviceRepository } from "../../ports/IDeviceRepository";

export interface RegisterDeviceInput {
  organizationId: string;
  label: string;
  location?: string | null;
}

export class RegisterDeviceUseCase {
  constructor(private readonly deviceRepo: IDeviceRepository) {}

  async execute(input: RegisterDeviceInput): Promise<DeviceSnapshot> {
    return this.deviceRepo.create({
      organizationId: input.organizationId,
      label: input.label,
      location: input.location ?? null,
    });
  }
}
