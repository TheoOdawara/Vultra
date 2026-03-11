import { pgTable, uuid, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { organizations } from './organizations';

export const members = pgTable('members', {
  id: uuid('id')
    .notNull()
    .default(sql`gen_uuid_v7()`)
    .primaryKey(),

  organizationId: uuid('organization_id')
    .notNull()
    .references(() => organizations.id, { onDelete: 'restrict' }),

  /** UUID do usuário no Better Auth (nullable: membro pode existir sem conta de login) */
  userId: uuid('user_id'),

  fullName: text('full_name').notNull(),
  email:    text('email'),

  role: text('role', { enum: ['admin', 'professor', 'rh', 'student'] }).notNull(),

  /** Matrícula (aluno) ou código de funcionário — único por tenant entre membros ativos */
  externalCode: text('external_code'),

  isActive:  boolean('is_active').notNull().default(true),

  /** Soft-delete: NULL = membro ativo. Preenchido = desativado (LGPD: retenção controlada) */
  deletedAt: timestamp('deleted_at', { withTimezone: true }),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Member    = typeof members.$inferSelect;
export type NewMember = typeof members.$inferInsert;
