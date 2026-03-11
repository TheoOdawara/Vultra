import { pgTable, uuid, text, real, boolean, timestamp, primaryKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { attendanceSessions } from './attendance-sessions';
import { members } from './members';

/**
 * Registros de presença individual.
 *
 * IMPORTANTE: Esta tabela é PARTICIONADA no banco de dados por `recorded_at`
 * (partições trimestrais — migration 0007). O Drizzle ORM interage com a tabela
 * pai e o roteamento para partições é transparente ao ORM.
 *
 * Constraints críticas (definidas na migration SQL, não replicáveis no Drizzle):
 *  - PRIMARY KEY composta (id, recorded_at) — requisito de tabelas particionadas
 *  - UNIQUE (session_id, member_id, recorded_at) — impede duplicata; retorna HTTP 409
 *  - CHECK em confidence_score, match_threshold e sentiment_score BETWEEN 0 AND 1
 */
export const attendanceRecords = pgTable(
  'attendance_records',
  {
    id: uuid('id')
      .notNull()
      .default(sql`gen_uuid_v7()`),

    organizationId: uuid('organization_id').notNull(),

    sessionId: uuid('session_id')
      .notNull()
      .references(() => attendanceSessions.id, { onDelete: 'restrict' }),

    memberId: uuid('member_id')
      .notNull()
      .references(() => members.id, { onDelete: 'restrict' }),

    /** Coluna de partição — obrigatória na PK composta */
    recordedAt: timestamp('recorded_at', { withTimezone: true }).notNull().defaultNow(),

    /** Similaridade cosseno [0,1] retornada pelo AI Service */
    confidenceScore: real('confidence_score').notNull(),

    /** Snapshot do threshold vigente no match — para auditoria de falsos positivos */
    matchThreshold: real('match_threshold').notNull().default(0.85),

    recognitionMethod: text('recognition_method', { enum: ['face', 'manual'] })
      .notNull()
      .default('face'),

    /** Sentimento dominante: happy | neutral | sad | angry | surprise | fear | disgust */
    sentimentLabel: text('sentiment_label'),

    /** Score do sentimento dominante [0, 1] */
    sentimentScore: real('sentiment_score'),

    /** TRUE quando inserido manualmente pelo professor via interface */
    isManual: boolean('is_manual').notNull().default(false),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    /** PK composta: obrigatório incluir recorded_at (coluna de partição no PG) */
    pk: primaryKey({ columns: [table.id, table.recordedAt] }),
  }),
);

export type AttendanceRecord    = typeof attendanceRecords.$inferSelect;
export type NewAttendanceRecord = typeof attendanceRecords.$inferInsert;
