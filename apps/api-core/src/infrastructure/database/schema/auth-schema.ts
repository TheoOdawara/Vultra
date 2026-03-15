import { boolean, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * VULTRA — Schema Better Auth
 *
 * Todas as tabelas usam o prefixo `auth_` para evitar colisão com as
 * tabelas de domínio (`organizations`, `members`, etc.).
 *
 * IDs: TEXT (padrão Better Auth). O generateId em `auth.ts` produz
 * UUID v7 como string, mantendo ordenação temporal consistente.
 *
 * SEM RLS: Better Auth gerencia acesso internamente via sessão/token.
 * O isolamento multitenant é aplicado apenas nas tabelas de domínio.
 *
 * ⚠️  NÃO adicionar FK entre auth_organizations e organizations de domínio
 * aqui — essa relação é gerida no nível de aplicação (UseCase de criação
 * de tenant). Consulte docs/backend/manuais/autenticacao.md.
 */

// ─────────────────────────────────────────────
// CORE — Tabelas mínimas exigidas pelo Better Auth
// ─────────────────────────────────────────────

export const authUsers = pgTable("auth_users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authSessions = pgTable("auth_sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
});

export const authAccounts = pgTable("auth_accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  /** Senha hash (bcrypt) para o provider email/password. NUNCA plaintext. */
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authVerifications = pgTable("auth_verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────
// PLUGIN: Organization
// Tabelas do contexto de autenticação — ≠ tabelas de domínio.
// A `organizations` de domínio só é criada após provisioning via endpoint.
// ─────────────────────────────────────────────

export const authOrganizations = pgTable("auth_organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Slug único gerado a partir do name (ex: "escola-estadual-sp"). */
  slug: text("slug").unique(),
  logo: text("logo"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  /** JSONB serializado como texto — Better Auth padrão. */
  metadata: text("metadata"),
});

/** Membros de uma organização no contexto de auth (≠ membros de domínio). */
export const authMembers = pgTable("auth_members", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => authOrganizations.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  /**
   * Role no contexto de auth: 'admin' | 'professor' | 'rh' | 'student'.
   * Mapeia para AccessControl definido em auth.ts.
   */
  role: text("role").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const authInvitations = pgTable("auth_invitations", {
  id: text("id").primaryKey(),
  organizationId: text("organization_id")
    .notNull()
    .references(() => authOrganizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role"),
  /** 'pending' | 'accepted' | 'rejected' | 'canceled' */
  status: text("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  inviterId: text("inviter_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
});

// ─────────────────────────────────────────────
// PLUGIN: Passkey (WebAuthn)
// Tabela criada em migration 0013 e mantida aqui para uso futuro.
// O plugin `passkey` não está disponível no better-auth ≤ 1.5.5 —
// ativar ao fazer upgrade de versão e adicionar ao adapter em auth.ts.
// ─────────────────────────────────────────────

export const authPasskeys = pgTable("auth_passkeys", {
  id: text("id").primaryKey(),
  name: text("name"),
  publicKey: text("public_key").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  webauthnUserId: text("webauthn_user_id").notNull(),
  counter: integer("counter").notNull(),
  /** 'singleDevice' | 'multiDevice' */
  deviceType: text("device_type").notNull(),
  backedUp: boolean("backed_up").notNull(),
  /** CSV de transportes WebAuthn: 'usb,ble,nfc,internal' */
  transports: text("transports"),
  aaguid: text("aaguid"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────────
// Tipos inferidos
// ─────────────────────────────────────────────

export type AuthUser = typeof authUsers.$inferSelect;
export type NewAuthUser = typeof authUsers.$inferInsert;

export type AuthSession = typeof authSessions.$inferSelect;
export type NewAuthSession = typeof authSessions.$inferInsert;

export type AuthAccount = typeof authAccounts.$inferSelect;
export type NewAuthAccount = typeof authAccounts.$inferInsert;

export type AuthOrganization = typeof authOrganizations.$inferSelect;
export type NewAuthOrganization = typeof authOrganizations.$inferInsert;

export type AuthMember = typeof authMembers.$inferSelect;
export type NewAuthMember = typeof authMembers.$inferInsert;

export type AuthInvitation = typeof authInvitations.$inferSelect;
export type NewAuthInvitation = typeof authInvitations.$inferInsert;

export type AuthPasskey = typeof authPasskeys.$inferSelect;
export type NewAuthPasskey = typeof authPasskeys.$inferInsert;
