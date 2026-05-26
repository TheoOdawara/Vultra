/**
 * VULTRA — Device Repository
 *
 * Handles database operations for the `devices` table.
 * API keys are stored as bcrypt hashes — plaintext is NEVER persisted.
 * All queries include organization_id filter (multitenancy).
 */

import { and, eq } from "drizzle-orm";
import type {
  CreateDeviceData,
  DeviceSnapshot,
  IDeviceRepository,
  ListDevicesFilter,
  UpdateDeviceData,
} from "../../core/ports/IDeviceRepository";
import type { Db } from "../../infrastructure/database/client";
import { devices } from "../../infrastructure/database/schema";

/**
 * Private type: full device row including api_key_hash.
 * Never returned from public-facing use cases.
 */
type DeviceRow = typeof devices.$inferSelect;

function toSnapshot(row: DeviceRow): DeviceSnapshot {
  return {
    id: row.id,
    organizationId: row.organizationId,
    label: row.label,
    location: row.location,
    firmwareVersion: row.firmwareVersion,
    lastSeenAt: row.lastSeenAt,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class DeviceRepository implements IDeviceRepository {
  constructor(private readonly db: Db) {}

  async findById(deviceId: string, organizationId: string): Promise<DeviceSnapshot | null> {
    const [row] = await this.db
      .select()
      .from(devices)
      .where(and(eq(devices.id, deviceId), eq(devices.organizationId, organizationId)))
      .limit(1);

    return row ? toSnapshot(row) : null;
  }

  async list(filter: ListDevicesFilter): Promise<DeviceSnapshot[]> {
    const conditions = [eq(devices.organizationId, filter.organizationId)];

    if (filter.isActive !== undefined) {
      conditions.push(eq(devices.isActive, filter.isActive));
    }

    const rows = await this.db
      .select()
      .from(devices)
      .where(and(...conditions))
      .orderBy(devices.label);

    return rows.map(toSnapshot);
  }

  async create(data: CreateDeviceData): Promise<DeviceSnapshot> {
    const [row] = await this.db
      .insert(devices)
      .values({
        organizationId: data.organizationId,
        label: data.label,
        location: data.location ?? null,
        apiKeyHash: data.apiKeyHash,
        isActive: true,
      })
      .returning();

    if (!row) {
      throw new Error("Failed to create device");
    }

    return toSnapshot(row);
  }

  async update(
    deviceId: string,
    organizationId: string,
    data: UpdateDeviceData
  ): Promise<DeviceSnapshot | null> {
    const updates: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (data.label !== undefined) updates.label = data.label;
    if (data.location !== undefined) updates.location = data.location;
    if (data.firmwareVersion !== undefined) updates.firmwareVersion = data.firmwareVersion;

    const [row] = await this.db
      .update(devices)
      .set(updates)
      .where(
        and(
          eq(devices.id, deviceId),
          eq(devices.organizationId, organizationId),
          eq(devices.isActive, true)
        )
      )
      .returning();

    return row ? toSnapshot(row) : null;
  }

  async rotateApiKey(
    deviceId: string,
    organizationId: string,
    newApiKeyHash: string
  ): Promise<boolean> {
    const [row] = await this.db
      .update(devices)
      .set({
        apiKeyHash: newApiKeyHash,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(devices.id, deviceId),
          eq(devices.organizationId, organizationId),
          eq(devices.isActive, true)
        )
      )
      .returning({ id: devices.id });

    return !!row;
  }

  async deactivate(deviceId: string, organizationId: string): Promise<boolean> {
    const [row] = await this.db
      .update(devices)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(devices.id, deviceId),
          eq(devices.organizationId, organizationId),
          eq(devices.isActive, true)
        )
      )
      .returning({ id: devices.id });

    return !!row;
  }
}
