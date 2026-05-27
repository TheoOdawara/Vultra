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
 *
 * LGPD: API key plaintext is never included in audit payloads.
 */

import type { AuditActorType, IAuditLogRepository } from "../../ports/IAuditLogRepository";
import type { DeviceSnapshot, IDeviceRepository } from "../../ports/IDeviceRepository";

export interface RegisterDeviceInput {
  organizationId: string;
  label: string;
  location?: string | null;
  actorId: string;
  actorType: AuditActorType;
}

export class RegisterDeviceUseCase {
  constructor(
    private readonly deviceRepo: IDeviceRepository,
    private readonly auditLogRepo: IAuditLogRepository
  ) {}

  async execute(input: RegisterDeviceInput): Promise<DeviceSnapshot> {
    const device = await this.deviceRepo.create({
      organizationId: input.organizationId,
      label: input.label,
      location: input.location ?? null,
    });

    // Audit DEVICE_REGISTERED — API key plaintext intentionally excluded
    await this.auditLogRepo.insert({
      organizationId: input.organizationId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: "DEVICE_REGISTERED",
      resourceType: "devices",
      resourceId: device.id,
      payload: {
        label: device.label,
        location: device.location,
      },
    });

    return device;
  }
}
