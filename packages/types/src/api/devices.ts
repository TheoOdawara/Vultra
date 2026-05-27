/**
 * VULTRA — Devices API Types
 *
 * Contracts for POST/GET/PATCH/DELETE /v1/devices
 */

import type { Device } from "../domain.js";

// ── List Devices ───────────────────────────────────────────────────────────────

export interface ListDevicesQuery {
  /** "true" (default) | "false" | "all" */
  isActive?: "true" | "false" | "all";
}

/** HTTP 200 */
export type ListDevicesResponse = Device[];

// ── Register Device ────────────────────────────────────────────────────────────

export interface RegisterDeviceBody {
  label: string;
  location?: string;
}

/**
 * HTTP 201
 *
 * ⚠️ `apiKey` is returned **ONCE** — store it securely and flash it to device firmware.
 * It is stored as a bcrypt hash on the server and cannot be retrieved again.
 */
export interface RegisterDeviceResponse {
  device: Device;
  /** Plaintext API key — shown ONCE. Use POST /v1/devices/:id/rotate-key if lost. */
  apiKey: string;
}

// ── Update Device ─────────────────────────────────────────────────────────────

export interface UpdateDeviceBody {
  label?: string;
  location?: string | null;
  firmwareVersion?: string | null;
}

/** HTTP 200 */
export type UpdateDeviceResponse = Device;

// ── Rotate API Key ─────────────────────────────────────────────────────────────

/**
 * HTTP 200
 *
 * ⚠️ The old key is immediately invalidated. Flash the new key to firmware immediately.
 */
export interface RotateDeviceKeyResponse {
  /** New plaintext API key — returned ONCE. */
  apiKey: string;
}

// ── Deactivate Device ─────────────────────────────────────────────────────────

/** HTTP 200 */
export interface DeactivateDeviceResponse {
  success: boolean;
}
