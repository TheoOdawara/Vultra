/**
 * VULTRA — Device Use Case Errors
 *
 * Centralised error classes for the devices domain.
 * Import from here — never from a peer use case file.
 */

import { DomainError } from "../../domain/errors/DomainError";

export class DeviceNotFoundError extends DomainError {
  constructor() {
    super("DEVICE_NOT_FOUND", 404, "Device not found or inactive");
  }
}
