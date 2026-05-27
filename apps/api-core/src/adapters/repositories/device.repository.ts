/**
 * VULTRA — Device Repository
 *
 * Handles database operations for the `devices` table.
 * All queries run inside withTenantContext to activate RLS for the tenant.
 * Application-level organizationId filters are kept as defense-in-depth.
 *
 * API key management is handled by Better Auth (@better-auth/api-key plugin).
 * This repository stores only business data — no credential hashes.
 */

import { and, eq } from "drizzle-orm";
import type {
  CreateDeviceData,
  DeviceSnapshot,
  IDeviceRepository,
  ListDevicesFilter,
  UpdateDeviceData,
} from "../../core/ports/IDeviceRepository";
import { withTenantContext } from "../../infrastructure/database/client";
import type { Db, Tx } from "../../infrastructure/database/client";
import { devices } from "../../infrastructure/database/schema";

/**
 * Private type: full device row.
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
    return withTenantContext(this.db, organizationId, async (tx: Tx) => {
      const [row] = await tx
        .select()
        .from(devices)
        .where(and(eq(devices.id, deviceId), eq(devices.organizationId, organizationId)))
        .limit(1);

      return row ? toSnapshot(row) : null;
    });
  }

  async list(filter: ListDevicesFilter): Promise<DeviceSnapshot[]> {
    return withTenantContext(this.db, filter.organizationId, async (tx: Tx) => {
      const conditions = [eq(devices.organizationId, filter.organizationId)];

      if (filter.isActive !== undefined) {
        conditions.push(eq(devices.isActive, filter.isActive));
      }

      const rows = await tx
        .select()
        .from(devices)
        .where(and(...conditions))
        .orderBy(devices.label);

      return rows.map(toSnapshot);
    });
  }

  async create(data: CreateDeviceData): Promise<DeviceSnapshot> {
    return withTenantContext(this.db, data.organizationId, async (tx: Tx) => {
      const [row] = await tx
        .insert(devices)
        .values({
          organizationId: data.organizationId,
          label: data.label,
          location: data.location ?? null,
          isActive: true,
        })
        .returning();

      if (!row) {
        throw new Error("Failed to create device");
      }

      return toSnapshot(row);
    });
  }

  async update(
    deviceId: string,
    organizationId: string,
    data: UpdateDeviceData
  ): Promise<DeviceSnapshot | null> {
    return withTenantContext(this.db, organizationId, async (tx: Tx) => {
      const updates: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (data.label !== undefined) updates.label = data.label;
      if (data.location !== undefined) updates.location = data.location;
      if (data.firmwareVersion !== undefined) updates.firmwareVersion = data.firmwareVersion;

      const [row] = await tx
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
    });
  }

  async deactivate(deviceId: string, organizationId: string): Promise<boolean> {
    return withTenantContext(this.db, organizationId, async (tx: Tx) => {
      const [row] = await tx
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
    });
  }
}
