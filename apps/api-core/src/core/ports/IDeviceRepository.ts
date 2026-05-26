/**
 * VULTRA — IDeviceRepository Port
 *
 * Contract consumed by Device Use Cases.
 * Implementations live in adapters/repositories/.
 * Use Cases NEVER import concrete classes.
 */

// ── Domain snapshots ──────────────────────────────────────────────────────────

export interface DeviceSnapshot {
  id: string;
  organizationId: string;
  label: string;
  location: string | null;
  firmwareVersion: string | null;
  lastSeenAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateDeviceData {
  organizationId: string;
  label: string;
  location?: string | null;
  apiKeyHash: string;
}

export interface UpdateDeviceData {
  label?: string;
  location?: string | null;
  firmwareVersion?: string | null;
}

export interface ListDevicesFilter {
  organizationId: string;
  isActive?: boolean;
}

// ── Port interface ────────────────────────────────────────────────────────────

export interface IDeviceRepository {
  findById(deviceId: string, organizationId: string): Promise<DeviceSnapshot | null>;
  list(filter: ListDevicesFilter): Promise<DeviceSnapshot[]>;
  create(data: CreateDeviceData): Promise<DeviceSnapshot>;
  update(
    deviceId: string,
    organizationId: string,
    data: UpdateDeviceData
  ): Promise<DeviceSnapshot | null>;
  rotateApiKey(deviceId: string, organizationId: string, newApiKeyHash: string): Promise<boolean>;
  deactivate(deviceId: string, organizationId: string): Promise<boolean>;
}
