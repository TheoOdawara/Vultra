/**
 * VULTRA — RegisterDeviceUseCase
 *
 * POST /v1/devices
 * Registers a new ESP32-CAM device for a tenant.
 *
 * Security:
 * - Generates a cryptographically random API key (32-byte hex string)
 * - Hashes with bcrypt before storing — plaintext is NEVER persisted
 * - Returns the plaintext key ONCE in the response — store it securely
 */

import type { DeviceSnapshot, IDeviceRepository } from "../../ports/IDeviceRepository";

export interface RegisterDeviceInput {
  organizationId: string;
  label: string;
  location?: string | null;
}

export interface RegisterDeviceOutput {
  device: DeviceSnapshot;
  /** Plaintext API key — returned ONCE. Store immediately. */
  apiKey: string;
}

export class RegisterDeviceUseCase {
  constructor(private readonly deviceRepo: IDeviceRepository) {}

  async execute(input: RegisterDeviceInput): Promise<RegisterDeviceOutput> {
    // 1. Generate a secure random API key (256 bits of entropy)
    const rawBytes = crypto.getRandomValues(new Uint8Array(32));
    const apiKey = Array.from(rawBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    // 2. Hash with bcrypt (cost factor 10 — fast enough for provisioning, safe at rest)
    const apiKeyHash = await Bun.password.hash(apiKey, { algorithm: "bcrypt", cost: 10 });

    // 3. Persist — only the hash is stored
    const device = await this.deviceRepo.create({
      organizationId: input.organizationId,
      label: input.label,
      location: input.location ?? null,
      apiKeyHash,
    });

    return { device, apiKey };
  }
}
