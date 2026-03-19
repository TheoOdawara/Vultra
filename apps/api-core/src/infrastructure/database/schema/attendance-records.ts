import { sql } from "drizzle-orm";
import { boolean, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { attendanceSessions } from "./attendance-sessions";
import { members } from "./members";

export const attendanceRecords = pgTable("attendance_records", {
  id: uuid("id").primaryKey().default(sql`gen_uuid_v7()`),

  organizationId: uuid("organization_id").notNull(),

  sessionId: uuid("session_id")
    .notNull()
    .references(() => attendanceSessions.id, { onDelete: "restrict" }),

  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id, { onDelete: "restrict" }),

  recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),

  /** Similaridade cosseno [0,1] retornada pelo AI Service */
  confidenceScore: real("confidence_score").notNull(),

  /** Snapshot do threshold vigente no match — para auditoria de falsos positivos */
  matchThreshold: real("match_threshold").notNull().default(0.85),

  recognitionMethod: text("recognition_method", { enum: ["face", "manual"] })
    .notNull()
    .default("face"),

  /** Sentimento dominante: happy | neutral | sad | angry | surprise | fear | disgust */
  sentimentLabel: text("sentiment_label"),

  /** Score do sentimento dominante [0, 1] */
  sentimentScore: real("sentiment_score"),

  /** TRUE quando inserido manualmente pelo professor via interface */
  isManual: boolean("is_manual").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
export type NewAttendanceRecord = typeof attendanceRecords.$inferInsert;
