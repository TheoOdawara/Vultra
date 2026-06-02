import { sql } from "drizzle-orm";
import { boolean, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations } from "./organizations";

/**
 * Stores device business data only. Credentials are managed by Better Auth
 * (@better-auth/api-key plugin) and stored in auth_api_keys — never here.
 */
export const devices = pgTable("devices", {
  id: uuid("id").notNull().default(sql`gen_uuid_v7()`).primaryKey(),

  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "restrict" }),

  /** Identificador legível. Ex: 'CAM-SALA-101', 'CAM-ENTRADA-RH' */
  label: text("label").notNull(),
  location: text("location"),
  firmwareVersion: text("firmware_version"),

  /** Atualizado a cada heartbeat do firmware ESP32 */
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),

  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
