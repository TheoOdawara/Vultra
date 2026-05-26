/**
 * VULTRA — RotateDeviceKeyUseCase
 *
 * POST /v1/devices/:id/rotate-key
 * Rotates the API key for an ESP32-CAM device.
 *
 * Security contract:
 * - Old key is immediately invalidated upon rotation
 * - New plaintext key is returned ONCE in the response
 * - Hash is stored with bcrypt (cost 10) — plaintext NEVER persisted
 *
 * After rotation, the device firmware must be updated with the new key.
 */

import { DomainError } from "../../domain/errors/DomainError";
import type { IDeviceRepository } from "../../ports/IDeviceRepository";

export class DeviceNotFoundError extends DomainError {
  constructor() {
    super("DEVICE_NOT_FOUND", 404, "Device not found or inactive");
  }
}

export interface RotateDeviceKeyInput {
  deviceId: string;
  organizationId: string;
}

export interface RotateDeviceKeyOutput {
  /** New plaintext API key — returned ONCE. Update firmware immediately. */
  apiKey: string;
}

export class RotateDeviceKeyUseCase {
  constructor(private readonly deviceRepo: IDeviceRepository) {}

  async execute(input: RotateDeviceKeyInput): Promise<RotateDeviceKeyOutput> {
    // 1. Generate new secure random key
    const rawBytes = crypto.getRandomValues(new Uint8Array(32));
    const apiKey = Array.from(rawBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // 2. Hash
    const newApiKeyHash = await Bun.password.hash(apiKey, { algorithm: "bcrypt", cost: 10 });

    // 3. Atomically replace hash in DB
    const rotated = await this.deviceRepo.rotateApiKey(
      input.deviceId,
      input.organizationId,
      newApiKeyHash
    );

    if (!rotated) throw new DeviceNotFoundError();

    return { apiKey };
  }
}
