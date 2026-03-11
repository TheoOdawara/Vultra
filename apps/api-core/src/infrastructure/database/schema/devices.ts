import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';

export const devices = pgTable('devices', {
  id: uuid('id')
    .notNull()
    .default(sql`gen_uuid_v7()`)
    .primaryKey(),

  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),

  /** Hash bcrypt do X-Device-Token. NUNCA armazenar o token em plaintext */
  apiKeyHash: text('api_key_hash').notNull().unique(),

  /** Identificador legível. Ex: 'CAM-SALA-101', 'CAM-ENTRADA-RH' */
  label:           text('label').notNull(),
  location:        text('location'),
  firmwareVersion: text('firmware_version'),

  /** Atualizado a cada heartbeat do firmware ESP32 */
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),

  isActive: boolean('is_active').notNull().default(true),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Device    = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
