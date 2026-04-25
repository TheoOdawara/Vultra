/**
 * VULTRA — Barrel de exportação do schema Drizzle ORM
 *
 * Exporta todas as definições de tabela, tipos inferidos e relations
 * para uso no database client e nos repositórios da camada de infraestrutura.
 */

// Tipos customizados
export * from "./_types";
export * from "./attendance-records";
export * from "./attendance-sessions";
export * from "./audit-logs";
// Tabelas Better Auth (prefixo auth_) — autenticação & autorização
export * from "./auth-schema";
export * from "./biometric-profiles";
export * from "./devices";
export * from "./members";
// Tabelas e tipos inferidos — domínio VULTRA
export * from "./organizations";

// ---------------------------------------------------------------------------
// Drizzle Relations — habilita `db.query.*` com joins tipados
// ---------------------------------------------------------------------------
import { relations } from "drizzle-orm";
import { attendanceRecords } from "./attendance-records";
import { attendanceSessions } from "./attendance-sessions";
import { biometricProfiles } from "./biometric-profiles";
import { devices } from "./devices";
import { members } from "./members";
import { organizations } from "./organizations";

export const organizationsRelations = relations(organizations, ({ many }) => ({
  members: many(members),
  devices: many(devices),
  attendanceSessions: many(attendanceSessions),
}));

export const membersRelations = relations(members, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [members.organizationId],
    references: [organizations.id],
  }),
  biometricProfiles: many(biometricProfiles),
  attendanceRecords: many(attendanceRecords),
}));

export const devicesRelations = relations(devices, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [devices.organizationId],
    references: [organizations.id],
  }),
  attendanceSessions: many(attendanceSessions),
}));

export const biometricProfilesRelations = relations(biometricProfiles, ({ one }) => ({
  organization: one(organizations, {
    fields: [biometricProfiles.organizationId],
    references: [organizations.id],
  }),
  member: one(members, {
    fields: [biometricProfiles.memberId],
    references: [members.id],
  }),
}));

export const attendanceSessionsRelations = relations(attendanceSessions, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [attendanceSessions.organizationId],
    references: [organizations.id],
  }),
  device: one(devices, {
    fields: [attendanceSessions.deviceId],
    references: [devices.id],
  }),
  attendanceRecords: many(attendanceRecords),
}));

export const attendanceRecordsRelations = relations(attendanceRecords, ({ one }) => ({
  session: one(attendanceSessions, {
    fields: [attendanceRecords.sessionId],
    references: [attendanceSessions.id],
  }),
  member: one(members, {
    fields: [attendanceRecords.memberId],
    references: [members.id],
  }),
}));
