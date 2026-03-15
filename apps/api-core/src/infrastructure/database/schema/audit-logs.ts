import { bigserial, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { inet } from "./_types";

/**
 * Log de auditoria imutável (append-only).
 *
 * Trigger `trg_audit_logs_immutable` no banco bloqueia UPDATE e DELETE.
 * organization_id declarado SEM FK intencional: preserva o histórico
 * mesmo que o tenant seja excluído da tabela organizations.
 *
 * Convenção para `action`: ENTIDADE_VERBO_PASSADO
 * Exemplos: ATTENDANCE_RECORD_CREATED, MEMBER_DELETED, BIOMETRIC_PROFILE_REVOKED
 */
export const auditLogs = pgTable("audit_logs", {
  /** BIGSERIAL: ordenação natural por criação sem overhead de timestamp sort */
  id: bigserial("id", { mode: "bigint" }).notNull().primaryKey(),

  /** UUID do tenant — SEM FK (imutabilidade histórica) */
  organizationId: uuid("organization_id").notNull(),

  /** NULL para ações automáticas do sistema (cron, webhook, AI service) */
  actorId: uuid("actor_id"),

  actorType: text("actor_type", { enum: ["user", "device", "system"] }).notNull(),

  /** Convenção: ENTIDADE_VERBO_PASSADO. Ex: ATTENDANCE_RECORD_CREATED */
  action: text("action").notNull(),

  /** Ex: 'attendance_records', 'biometric_profiles', 'members' */
  resourceType: text("resource_type").notNull(),

  resourceId: uuid("resource_id"),

  /** Snapshot JSONB do estado anterior e/ou posterior do recurso */
  payload: jsonb("payload").notNull().default({}),

  /** Endereço IP de origem (IPv4 ou IPv6) */
  ipAddress: inet("ip_address"),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;
