import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { devices } from "./devices";
import { organizations } from "./organizations";

export const attendanceSessions = pgTable("attendance_sessions", {
  id: uuid("id").notNull().default(sql`gen_uuid_v7()`).primaryKey(),

  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "restrict" }),

  /** NULL = check-in corporativo (RH). Preenchido = chamada em aula */
  classId: uuid("class_id"),

  deviceId: uuid("device_id")
    .notNull()
    .references(() => devices.id, { onDelete: "restrict" }),

  /**
   * UUID do membro com role='professor'.
   * FK lógica (não enforçada no banco para evitar ciclo com soft-delete).
   * Enforçada na camada de aplicação.
   */
  professorId: uuid("professor_id"),

  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true }),

  status: text("status", { enum: ["open", "closed", "cancelled"] })
    .notNull()
    .default("open"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AttendanceSession = typeof attendanceSessions.$inferSelect;
export type NewAttendanceSession = typeof attendanceSessions.$inferInsert;
